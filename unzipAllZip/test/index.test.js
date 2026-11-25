import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function createDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'unzip-all-zip-'));
  temporaryDirectories.push(directory);
  return directory;
}

function createZip(directory, name, entries) {
  const zip = new AdmZip();
  for (const [entryName, content] of Object.entries(entries)) {
    zip.addFile(entryName, Buffer.from(content));
  }
  const zipPath = path.join(directory, name);
  zip.writeZip(zipPath);
  return zipPath;
}

function run(directory) {
  const script = fileURLToPath(new URL('../index.js', import.meta.url));
  return spawnSync(process.execPath, [script, directory], {
    encoding: 'utf8',
  });
}

test('recursively extracts all ZIP entries flat beside their respective archives', () => {
  const directory = createDirectory();
  const trip = path.join(directory, 'trip', 'day-1');
  const otherTrip = path.join(directory, 'other trip');
  fs.mkdirSync(trip, { recursive: true });
  fs.mkdirSync(otherTrip);
  const rootZip = createZip(directory, 'root.zip', { 'nested/root.txt': 'root' });
  const tripZip = createZip(trip, 'photos.ZIP', {
    'nested/deeper/photo.HEIC': 'new photo',
    'nested/notes.txt': 'notes',
    'nested/empty.txt': '',
  });
  const otherZip = createZip(otherTrip, 'photos.zip', { 'nested/photo.HEIC': 'other photo' });

  const result = run(directory);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(directory, 'root.txt'), 'utf8'), 'root');
  assert.equal(fs.existsSync(path.join(directory, 'photo.HEIC')), false);
  assert.equal(fs.readFileSync(path.join(trip, 'photo.HEIC'), 'utf8'), 'new photo');
  assert.equal(fs.readFileSync(path.join(trip, 'notes.txt'), 'utf8'), 'notes');
  assert.equal(fs.statSync(path.join(trip, 'empty.txt')).size, 0);
  assert.equal(fs.readFileSync(path.join(otherTrip, 'photo.HEIC'), 'utf8'), 'other photo');
  assert.equal(fs.existsSync(path.join(trip, 'nested')), false);
  for (const archive of [rootZip, tripZip, otherZip]) {
    assert.equal(fs.existsSync(archive), false);
  }
});

test('preserves existing files and directories and numbers conflicting output names', () => {
  const directory = createDirectory();
  fs.writeFileSync(path.join(directory, 'photo.heic'), 'existing');
  fs.mkdirSync(path.join(directory, 'photo-1.heic'));
  const archive = createZip(directory, 'photos.zip', {
    'a/photo.heic': 'first image',
    'b/photo.heic': 'second image',
  });

  const result = run(directory);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(directory, 'photo.heic'), 'utf8'), 'existing');
  assert.equal(fs.statSync(path.join(directory, 'photo-1.heic')).isDirectory(), true);
  assert.equal(fs.readFileSync(path.join(directory, 'photo-2.heic'), 'utf8'), 'first image');
  assert.equal(fs.readFileSync(path.join(directory, 'photo-3.heic'), 'utf8'), 'second image');
  assert.equal(fs.existsSync(archive), false);
});

test('rolls back partial output, retains the failed ZIP, and processes remaining ZIPs', () => {
  const directory = createDirectory();
  const failedZip = createZip(directory, 'a.zip', {
    'a-first.txt': 'should be rolled back',
    [`z${'z'.repeat(300)}.txt`]: 'filename is too long',
  });
  const successfulZip = createZip(directory, 'b.zip', { 'good.txt': 'good file' });

  const result = run(directory);

  assert.equal(result.status, 1);
  assert.equal(fs.existsSync(path.join(directory, 'a-first.txt')), false);
  assert.equal(fs.existsSync(failedZip), true);
  assert.equal(fs.existsSync(successfulZip), false);
  assert.equal(fs.readFileSync(path.join(directory, 'good.txt'), 'utf8'), 'good file');
});

test('rejects a file path as input', () => {
  const directory = createDirectory();
  const filePath = path.join(directory, 'input.txt');
  fs.writeFileSync(filePath, 'file');

  const result = run(filePath);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /폴더를 읽을 수 없습니다/);
});

test('continues after a corrupt ZIP and leaves it for inspection', () => {
  const directory = createDirectory();
  const corruptZip = path.join(directory, 'a.zip');
  fs.writeFileSync(corruptZip, 'not a ZIP');
  const successfulZip = createZip(directory, 'b.zip', { 'photo.heic': 'image' });

  const result = run(directory);

  assert.equal(result.status, 1);
  assert.equal(fs.existsSync(corruptZip), true);
  assert.equal(fs.existsSync(successfulZip), false);
  assert.equal(fs.readFileSync(path.join(directory, 'photo.heic'), 'utf8'), 'image');
});

test('removes a processed empty ZIP', () => {
  const directory = createDirectory();
  const zipPath = createZip(directory, 'empty.zip', {});

  const result = run(directory);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(zipPath), false);
  assert.deepEqual(fs.readdirSync(directory), []);
});
