import { parseArgs } from 'node:util';
import { normalizeFormat } from './converter.js';

export function parseArguments(args) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      quality: { type: 'string', short: 'q' },
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
  const [requestedFormat, ...inputs] = positionals;
  const format = normalizeFormat(requestedFormat);
  if (!format || inputs.length === 0) {
    throw new Error('출력 형식과 입력 경로를 지정하세요.');
  }
  return { format, inputs, quality };
}
