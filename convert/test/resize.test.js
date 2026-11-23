import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import sharp from 'sharp';
import { parseArguments } from '../arguments.js';

sharp.cache(false);
const cli = fileURLToPath(new URL('../index.js', import.meta.url));

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lib-resize-'));
  t.after(async () => {
    assert.equal(path.dirname(directory), os.tmpdir());
    assert.ok(path.basename(directory).startsWith('lib-resize-'));
    await fs.rm(directory, { recursive: true, force: true });
  });
  return directory;
}

function run(directory, ...args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: directory, encoding: 'utf8', timeout: 30000,
  });
}

test('accepts preset and custom scales and rejects invalid scales', () => {
  for (const [value, expected] of [['1/2', 0.5], ['1/3', 1 / 3], ['1/4', 0.25], ['0.4', 0.4], ['2/5', 0.4]]) {
    assert.equal(parseArguments(['--resize', value, 'photos']).scale, expected);
  }
  for (const value of ['0', '1', '2', '-0.5', '1/0', 'abc', '']) {
    assert.throws(() => parseArguments([`--resize=${value}`, 'photos']), /축소 비율/);
  }
});

test('resizes PNG, JPEG and TIFF into separate folders without overwriting originals or existing outputs', async t => {
  const directory = await fixture(t);
  for (const [name, format] of [['a.png', 'png'], ['b.jpg', 'jpeg'], ['c.tif', 'tiff']]) {
    const source = path.join(directory, name);
    await sharp({ create: { width: 120, height: 80, channels: 3, background: '#aabbcc' } })
      .toFormat(format).toFile(source);
    const original = await fs.readFile(source);
    const first = run(directory, '-r', '1/3', name);
    assert.equal(first.status, 0, first.stderr);
    const extension = format === 'jpeg' ? 'jpg' : format;
    const output = path.join(directory, 'out', `${path.parse(name).name}.${extension}`);
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.width, 40);
    assert.equal(metadata.height, 27);
    assert.deepEqual(await fs.readFile(source), original);
    const result = run(directory, '--resize', '1/3', name);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await fs.readFile(source), original);
    assert.ok((await fs.readdir(path.join(directory, 'out'))).includes(`${path.parse(name).name}-1.${extension}`));
  }
});

test('preserves 16-bit PNG depth and ICC profile when resizing', async t => {
  const directory = await fixture(t);
  const source = path.join(directory, 'color.png');
  await sharp({ create: { width: 120, height: 90, channels: 3, background: '#997755' } })
    .toColourspace('rgb16').withMetadata().png().toFile(source);
  const before = await sharp(source).metadata();
  assert.equal(before.bitsPerSample, 16);
  assert.ok(before.icc?.length);
  const result = run(directory, '-r', '1/4', source);
  assert.equal(result.status, 0, result.stderr);
  const after = await sharp(path.join(directory, 'out', 'color.png')).metadata();
  assert.equal(after.bitsPerSample, 16);
  assert.deepEqual(after.icc, before.icc);
  assert.equal(after.width, 30);
  assert.equal(after.height, 23);
});

test('skips unsupported files and leaves source directory untouched when inputs are invalid', async t => {
  const directory = await fixture(t);
  await fs.writeFile(path.join(directory, 'photo.cr2'), 'raw');
  const result = run(directory, '--resize', '1/3', '.');
  assert.equal(result.status, 1);
  assert.deepEqual(await fs.readdir(directory), ['photo.cr2']);
});

test('combines resize, format conversion and quality after applying EXIF orientation', async t => {
  const directory = await fixture(t);
  const source = path.join(directory, 'portrait.jpg');
  await sharp({ create: { width: 90, height: 60, channels: 3, background: '#997755' } })
    .withMetadata({ orientation: 6 }).jpeg().toFile(source);
  const result = run(directory, 'webp|png', '-q', '85', source, '--resize=1/3');
  assert.equal(result.status, 0, result.stderr);
  for (const extension of ['webp', 'png']) {
    const { width, height, format, orientation } = await sharp(
      path.join(directory, 'out', `portrait.${extension}`),
    ).metadata();
    assert.equal(format, extension);
    assert.equal(width, 20);
    assert.equal(height, 30);
    assert.ok(orientation === undefined || orientation === 1);
  }
});
