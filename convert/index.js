import { collectInputs } from './inputs.js';
import { createConverter, normalizeFormat, saveOutput } from './converter.js';

const usage = `사용법: pnpm convert <출력 형식> <파일·폴더·glob...>
출력 형식: jpg, jpeg, png, webp, avif, tif, tiff

예시:
  pnpm convert jpg "D:/photos"
  pnpm convert webp "./photos/**/*.HEIC" "./other/photo.CR3"

폴더는 하위까지 탐색합니다. glob은 따옴표로 감싸세요.
결과는 원본 옆의 out 폴더에 저장합니다. 같은 이름은 번호를 붙입니다.
폴더·glob 탐색 시 out, node_modules, .git 폴더는 제외합니다.`;

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log(usage);
    return;
  }
  const [requestedFormat, ...inputs] = args;
  const format = normalizeFormat(requestedFormat);
  if (!format || inputs.length === 0) {
    console.error(usage);
    process.exitCode = 1;
    return;
  }

  const { files, errors } = await collectInputs(inputs);
  for (const error of errors) console.error(`❌ ${error}`);
  console.log(`🔍 ${files.length}개 이미지를 ${format} 형식으로 변환합니다.`);
  const converter = createConverter();
  let converted = 0;
  let failed = errors.length;
  try {
    // 큰 RAW 이미지가 한꺼번에 메모리에 올라오지 않도록 순서대로 처리합니다.
    for (const file of files) {
      try {
        const buffer = await converter.convert(file, format);
        const output = await saveOutput(file, format, buffer);
        converted++;
        console.log(`✅ ${file} → ${output}`);
      } catch (error) {
        failed++;
        console.error(`❌ ${file}: ${error.message}`);
      }
    }
  } finally {
    await converter.close();
  }
  console.log(`완료: ${converted}개 성공, ${failed}개 오류`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error(`❌ ${error.message}`);
  process.exitCode = 1;
});
