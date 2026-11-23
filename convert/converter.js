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

function resizeImage(image, metadata, scale, orientation = metadata.orientation) {
  const { width, height } = metadata;
  if (!width || !height) throw new Error('이미지 크기를 확인할 수 없습니다.');
  const swapped = orientation >= 5 && orientation <= 8;
  const targetWidth = Math.max(1, Math.round((swapped ? height : width) * scale));
  const targetHeight = Math.max(1, Math.round((swapped ? width : height) * scale));
  return image.resize(targetWidth, targetHeight, { fit: 'inside', withoutEnlargement: true });
}

export function createConverter({ exiftool, decodeHeic = heicConvert } = {}) {
  let tool = exiftool;

  return {
    async resize(inputPath, scale) {
      const image = sharp(inputPath).autoOrient();
      const metadata = await image.metadata();
      const { format } = metadata;
      resizeImage(image, metadata, scale).keepMetadata();
      if (metadata.bitsPerSample === 16 && (format === 'png' || format === 'tiff')) {
        image.toColourspace('rgb16');
      }
      const options = format === 'tiff' ? { compression: 'lzw' } : {};
      return { buffer: await image.toFormat(format, options).toBuffer(), format };
    },
    async convert(inputPath, format, quality, scale) {
      const extension = path.extname(inputPath).toLowerCase();
      let image;
      let orientation;
      if (extension === '.cr3') {
        tool ??= new ExifTool();
        const preview = await tool.extractBinaryTagToBuffer('JpgFromRaw', inputPath);
        const tags = await tool.read(inputPath, { numericTags: ['Orientation'] });
        // 원본 CR3의 방향을 한 번만 적용합니다. 미리보기 자체의 EXIF는 무시합니다.
        orientation = tags.Orientation ?? 1;
        image = orient(sharp(preview), orientation);
      } else if (extension === '.heic' || extension === '.heif') {
        const buffer = await decodeHeic({
          buffer: await fs.readFile(inputPath), format: 'PNG', quality: 1,
        });
        image = sharp(buffer).autoOrient();
      } else {
        image = sharp(inputPath).autoOrient();
      }
      if (scale !== undefined) resizeImage(image, await image.metadata(), scale, orientation);

      const options = format === 'webp'
        ? { quality: 85, effort: 6, nearLossless: true }
        : {};
      if (quality !== undefined && format !== 'png') {
        // sharp 인코더의 quality 허용 범위는 1~100입니다.
        options.quality = Math.max(1, quality);
      }
      return image.keepMetadata().toFormat(format, options).toBuffer();
    },
    async preserveMetadata(inputPath, outputPath) {
      tool ??= new ExifTool();
      const { width, height } = await sharp(await fs.readFile(outputPath)).metadata();
      const result = await tool.write(outputPath, {}, {
        writeArgs: [
          '-overwrite_original',
          '-TagsFromFile', inputPath,
          '-all:all', '-ICC_Profile',
          '--Orientation', '--ImageWidth', '--ImageHeight',
          '--ExifImageWidth', '--ExifImageHeight',
          '--ThumbnailImage', '--PreviewImage', '--JpgFromRaw',
          '-Orientation#=1', '-XMP-tiff:Orientation#=1',
          `-ExifImageWidth=${width}`, `-ExifImageHeight=${height}`,
          `-XMP-tiff:ImageWidth=${width}`, `-XMP-tiff:ImageHeight=${height}`,
        ],
      });
      return result.warnings ?? [];
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
