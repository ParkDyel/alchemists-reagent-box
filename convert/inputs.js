import fs from 'node:fs/promises';
import path from 'node:path';
import glob from 'fast-glob';

const extensions = new Set([
  '.cr3', '.heic', '.heif', '.jpg', '.jpeg', '.png', '.webp',
  '.avif', '.tif', '.tiff', '.gif',
]);

export async function collectInputs(inputs, cwd = process.cwd()) {
  const files = new Map();
  const errors = [];
  const options = {
    cwd, absolute: true, onlyFiles: true, dot: true,
    followSymbolicLinks: false,
    ignore: ['**/out/**', '**/node_modules/**', '**/.git/**'],
  };

  for (const input of inputs) {
    try {
      const absolute = path.resolve(cwd, input);
      const stat = await fs.stat(absolute).catch(error => {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
        throw error;
      });
      let matches;
      if (stat?.isFile()) {
        matches = [absolute];
      } else if (stat?.isDirectory()) {
        matches = await glob('**/*', { ...options, cwd: absolute });
      } else {
        // Windows 경로의 구분자를 glob에서 사용하는 /로 통일합니다.
        matches = await glob(input.replaceAll('\\', '/'), options);
      }

      const images = matches.filter(file => extensions.has(path.extname(file).toLowerCase()));
      if (images.length === 0) {
        errors.push(`지원하는 이미지가 없습니다: ${input}`);
      }
      for (const file of images) {
        const real = await fs.realpath(file);
        const key = process.platform === 'win32' ? real.toLowerCase() : real;
        files.set(key, real);
      }
    } catch (error) {
      errors.push(`${input}: ${error.message}`);
    }
  }

  return { files: [...files.values()].sort(), errors };
}
