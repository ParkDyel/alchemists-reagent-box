import { parseArgs } from 'node:util';
import { normalizeFormat } from './converter.js';

export function parseArguments(args) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      quality: { type: 'string', short: 'q' },
      resize: { type: 'string', short: 'r' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) return { help: true };
  let quality;
  if (values.quality !== undefined) {
    if (!/^\d+$/.test(values.quality) || Number(values.quality) > 100) {
      throw new Error('품질(-q)은 0~100 사이의 정수여야 합니다.');
    }
    quality = Number(values.quality);
  }
  let scale;
  if (values.resize !== undefined) {
    const match = /^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/.exec(values.resize);
    scale = match ? Number(match[1]) / Number(match[2] ?? 1) : NaN;
    if (!Number.isFinite(scale) || scale <= 0 || scale >= 1) {
      throw new Error('축소 비율(-r)은 0보다 크고 1보다 작아야 합니다.');
    }
  }
  const [requestedFormat, ...inputs] = positionals;
  const requestedFormats = requestedFormat?.split('|').map(value => value.trim()) ?? [];
  const normalizedFormats = requestedFormats.map(normalizeFormat);
  if (inputs.length > 0 && normalizedFormats.every(Boolean)) {
    return { formats: [...new Set(normalizedFormats)], inputs, quality, scale };
  }
  if (scale !== undefined && positionals.length > 0) {
    if (quality !== undefined) throw new Error('품질(-q)을 사용하려면 출력 형식을 지정하세요.');
    return { inputs: positionals, scale };
  }
  throw new Error('입력 경로와 출력 형식 또는 축소 옵션(-r)을 지정하세요.');
}
