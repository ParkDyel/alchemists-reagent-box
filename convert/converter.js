import fs from 'node:fs/promises';
import path from 'node:path';
import { ExifTool } from 'exiftool-vendored';
import heicConvert from 'heic-convert';
import sharp from 'sharp';

const formats = new Map([
  ['jpg', 'jpeg'], ['jpeg', 'jpeg'], ['png', 'png'], ['webp', 'webp'],
  ['avif', 'avif'], ['tif', 'tiff'], ['tiff', 'tiff'],
]);

export function normalizeFormat(value) {
  return formats.get(value?.toLowerCase());
}

function orient(image, orientation) {
  switch (orientation) {
    case 2: return image.flop();
    case 3: return image.rotate(180);
    case 4: return image.flip();
    case 5: return image.flip().rotate(90);
    case 6: return image.rotate(90);
    case 7: return image.flop().rotate(90);
    case 8: return image.rotate(270);
    default: return image;
  }
}

export function createConverter({ exiftool, decodeHeic = heicConvert } = {}) {
  let tool = exiftool;

  return {
    async convert(inputPath, format) {
      const extension = path.extname(inputPath).toLowerCase();
      let image;
      if (extension === '.cr3') {
        tool ??= new ExifTool();
        const preview = await tool.extractBinaryTagToBuffer('JpgFromRaw', inputPath);
        const tags = await tool.read(inputPath, { numericTags: ['Orientation'] });
        // 원본 CR3의 방향을 한 번만 적용합니다. 미리보기 자체의 EXIF는 무시합니다.
        image = orient(sharp(preview), tags.Orientation);
      } else if (extension === '.heic' || extension === '.heif') {
        const buffer = await decodeHeic({
          buffer: await fs.readFile(inputPath), format: 'PNG', quality: 1,
        });
        image = sharp(buffer).autoOrient();
      } else {
        image = sharp(inputPath).autoOrient();
      }

      const options = format === 'webp'
        ? { quality: 85, effort: 6, nearLossless: true }
        : {};
      return image.toFormat(format, options).toBuffer();
    },
    async close() {
      if (tool) await tool.end();
    },
  };
}

export async function saveOutput(inputPath, format, buffer) {
  const directory = path.join(path.dirname(inputPath), 'out');
  await fs.mkdir(directory, { recursive: true });
  const extension = format === 'jpeg' ? 'jpg' : format;
  const name = path.parse(inputPath).name;

  for (let suffix = 0; ; suffix++) {
    const output = path.join(directory, `${name}${suffix ? `-${suffix}` : ''}.${extension}`);
    let handle;
    try {
      handle = await fs.open(output, 'wx');
    } catch (error) {
      if (error.code === 'EEXIST') continue;
      throw error;
    }
    try {
      await handle.writeFile(buffer);
    } catch (error) {
      await handle.close();
      await fs.unlink(output);
      throw error;
    }
    await handle.close();
    return output;
  }
}
