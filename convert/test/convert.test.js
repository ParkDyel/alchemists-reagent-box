import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import sharp from 'sharp';
import { collectInputs } from '../inputs.js';
import { createConverter } from '../converter.js';

// libvips의 파일 캐시가 Windows 임시 파일 정리를 막지 않도록 합니다.
sharp.cache(false);

const cli = fileURLToPath(new URL('../index.js', import.meta.url));

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lib-convert-'));
  t.after(async () => {
    // 삭제 대상은 이 테스트가 만든 임시 폴더 하나로 제한합니다.
    assert.equal(path.dirname(directory), os.tmpdir());
    assert.ok(path.basename(directory).startsWith('lib-convert-'));
    await fs.rm(directory, { recursive: true, force: true });
  });
  return directory;
}

async function image(file, orientation) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  let pipeline = sharp({ create: {
    width: 12, height: 8, channels: 3, background: '#ff3300',
  } });
  if (orientation) pipeline = pipeline.withMetadata({ orientation });
  await pipeline.png().toFile(file);
}

function run(directory, ...args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: directory, encoding: 'utf8', timeout: 30000,
  });
}

test('recurses folders, accepts multiple paths and globs, deduplicates, and ignores output folders', async t => {
  const directory = await fixture(t);
  await image(path.join(directory, 'photos [trip]', 'nested', 'a.PNG'));
  await image(path.join(directory, 'photos [trip]', 'b.png'));
  await image(path.join(directory, 'photos [trip]', 'out', 'excluded.png'));
  await image(path.join(directory, 'photos [trip]', 'nested', 'out', 'excluded.png'));
  await image(path.join(directory, 'photos [trip]', 'node_modules', 'excluded.png'));
  await image(path.join(directory, 'other', 'c.png'));
  const { files, errors } = await collectInputs([
    'photos [trip]', 'photos [trip]/nested/a.PNG', './other/**/*.png',
  ], directory);
  assert.deepEqual(errors, []);
  assert.deepEqual(files.map(file => path.basename(file)).sort(), ['a.PNG', 'b.png', 'c.png']);

  const result = run(directory, 'webp', 'photos [trip]', 'other/**/*.png', 'other/c.png');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /3개 성공/);
  assert.equal((await sharp(path.join(directory, 'photos [trip]', 'nested', 'out', 'a.webp')).metadata()).format, 'webp');
  assert.deepEqual(await fs.readdir(path.join(directory, 'other', 'out')), ['c.webp']);
});

test('supports quoted globstar, uppercase extensions, and Windows pattern separators', async t => {
  const directory = await fixture(t);
  await image(path.join(directory, 'photos', 'nested', 'a.PNG'));
  await image(path.join(directory, 'photos', 'b.png'));
  const { files, errors } = await collectInputs(['photos\\**\\*.{PNG,png}'], directory);
  assert.equal(files.length, 2);
  assert.deepEqual(errors, []);
  const result = run(directory, 'jpg', 'photos/**/*');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /2개 성공/);
});

test('produces all output formats and applies EXIF orientation', async t => {
  const directory = await fixture(t);
  await image(path.join(directory, 'portrait.png'), 6);
  for (const [argument, extension, format] of [
    ['jpg', 'jpg', 'jpeg'], ['JPEG', 'jpg', 'jpeg'], ['png', 'png', 'png'],
    ['webp', 'webp', 'webp'], ['avif', 'avif', 'heif'],
    ['tif', 'tiff', 'tiff'], ['tiff', 'tiff', 'tiff'],
  ]) {
    const result = run(directory, argument, 'portrait.png');
    assert.equal(result.status, 0, `${argument}: ${result.stderr}`);
    const metadata = await sharp(path.join(directory, 'out', `portrait.${extension}`)).metadata();
    assert.equal(metadata.format, format);
    assert.equal(metadata.width, 8);
    assert.equal(metadata.height, 12);
    assert.ok(metadata.orientation === undefined || metadata.orientation === 1);
  }
});

test('preserves originals and existing outputs and gives collisions unique names', async t => {
  const directory = await fixture(t);
  const source = path.join(directory, 'same.png');
  await image(source);
  await sharp(source).jpeg().toFile(path.join(directory, 'same.jpg'));
  const original = await fs.readFile(source);
  await fs.mkdir(path.join(directory, 'out'));
  await fs.writeFile(path.join(directory, 'out', 'same.webp'), 'existing output');
  const result = run(directory, 'webp', '.');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await fs.readFile(path.join(directory, 'out', 'same.webp'), 'utf8'), 'existing output');
  assert.deepEqual(await fs.readFile(source), original);
  assert.deepEqual((await fs.readdir(path.join(directory, 'out'))).sort(), [
    'same-1.webp', 'same-2.webp', 'same.webp',
  ]);
});

test('reports missing inputs and corrupt images, continues processing, and exits unsuccessfully', async t => {
  const directory = await fixture(t);
  await fs.writeFile(path.join(directory, 'broken.heic'), 'invalid image');
  await fs.writeFile(path.join(directory, 'broken.cr3'), 'invalid RAW');
  await image(path.join(directory, 'good.png'));
  const result = run(directory, 'webp', 'missing/**/*', 'broken.heic', 'broken.cr3', 'good.png');
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /missing/);
  assert.match(result.stderr, /broken.heic/);
  assert.match(result.stderr, /broken.cr3/);
  assert.match(result.stdout, /1개 성공, 3개 오류/);
  assert.deepEqual(await fs.readdir(path.join(directory, 'out')), ['good.webp']);
  assert.equal(await fs.readFile(path.join(directory, 'broken.heic'), 'utf8'), 'invalid image');
});

test('validates CLI arguments and handles no matching images without creating outputs', async t => {
  const directory = await fixture(t);
  for (const args of [[], ['png'], ['unknown', '.'], ['png', 'missing/**/*'], ['png', '.']]) {
    assert.equal(run(directory, ...args).status, 1, args.join(' '));
  }
  assert.equal(run(directory, '--help').status, 0);
  assert.deepEqual(await fs.readdir(directory), []);
});

test('extracts CR3 previews, applies numeric orientation, and closes the ExifTool session', async t => {
  const directory = await fixture(t);
  const preview = await sharp({ create: {
    width: 12, height: 8, channels: 3, background: '#00ff00',
  } }).jpeg().toBuffer();
  let closed = false;
  const converter = createConverter({ exiftool: {
    async extractBinaryTagToBuffer(tag, input) {
      assert.equal(tag, 'JpgFromRaw');
      assert.equal(input, path.join(directory, 'photo.CR3'));
      return preview;
    },
    async read(input, options) {
      assert.deepEqual(options.numericTags, ['Orientation']);
      return { Orientation: 6 };
    },
    async end() { closed = true; },
  } });
  try {
    const output = await converter.convert(path.join(directory, 'photo.CR3'), 'png');
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.width, 8);
    assert.equal(metadata.height, 12);
  } finally {
    await converter.close();
  }
  assert.equal(closed, true);
  assert.deepEqual(await fs.readdir(directory), []);
});

test('decodes HEIC and HEIF to PNG before encoding the requested output format', async t => {
  const directory = await fixture(t);
  const decoded = await sharp({ create: {
    width: 4, height: 3, channels: 3, background: '#0000ff',
  } }).png().toBuffer();
  const converter = createConverter({ decodeHeic: async options => {
    assert.equal(options.buffer.toString(), 'encoded HEIC');
    assert.equal(options.format, 'PNG');
    return decoded;
  } });
  try {
    for (const extension of ['HEIC', 'heif']) {
      const input = path.join(directory, `photo.${extension}`);
      await fs.writeFile(input, 'encoded HEIC');
      const metadata = await sharp(await converter.convert(input, 'jpeg')).metadata();
      assert.equal(metadata.format, 'jpeg');
      assert.equal(metadata.width, 4);
      assert.equal(metadata.height, 3);
    }
  } finally {
    await converter.close();
  }
});
