import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, test } from 'node:test';
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
  return spawnSync(process.execPath, [path.resolve('index.js'), directory], {
    encoding: 'utf8',
  });
}

test('extracts HEIC files flat, overwrites existing files, and removes successful ZIPs', () => {
  const directory = createDirectory();
  fs.writeFileSync(path.join(directory, 'photo.HEIC'), 'old');
  const zipPath = createZip(directory, 'photos.ZIP', {
    'nested/photo.HEIC': 'new photo',
    'nested/notes.txt': 'notes',
  });

  const result = run(directory);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(directory, 'photo.HEIC'), 'utf8'), 'new photo');
  assert.equal(fs.existsSync(path.join(directory, 'notes.txt')), false);
  assert.equal(fs.existsSync(zipPath), false);
});

test('keeps a ZIP when an output path is a directory and continues with other ZIPs', () => {
  const directory = createDirectory();
  fs.mkdirSync(path.join(directory, 'blocked.heic'));
  const failedZip = createZip(directory, 'a.zip', { 'blocked.heic': 'image' });
  const successfulZip = createZip(directory, 'b.zip', { 'good.heic': 'good image' });

  const result = run(directory);

  assert.equal(result.status, 1);
  assert.equal(fs.existsSync(failedZip), true);
  assert.equal(fs.existsSync(successfulZip), false);
  assert.equal(fs.readFileSync(path.join(directory, 'good.heic'), 'utf8'), 'good image');
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

test('removes a processed ZIP without HEIC files', () => {
  const directory = createDirectory();
  const zipPath = createZip(directory, 'notes.zip', { 'notes.txt': 'notes' });

  const result = run(directory);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(zipPath), false);
  assert.equal(fs.existsSync(path.join(directory, 'notes.txt')), false);
});
