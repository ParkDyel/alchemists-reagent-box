import { collectInputs } from './inputs.js';
import { createConverter, saveOutput } from './converter.js';
import fs from 'node:fs/promises';
import { parseArguments } from './arguments.js';

const usage = `사용법: pnpm convert <출력 형식> [-q 0~100] <파일·폴더·glob...>
출력 형식: jpg, jpeg, png, webp, avif, tif, tiff
여러 형식: "jpg|png"처럼 |로 구분하고 반드시 따옴표로 감싸세요.
품질: -q, --quality 0~100 (정수). PNG는 무손실이며 -q를 적용하지 않습니다.
기본 품질: JPEG/TIFF 80, WebP 85, AVIF 50. 0은 인코더의 최저 품질 1로 처리합니다.

예시:
  pnpm convert jpg -q 95 "D:/photos"
  pnpm convert "jpg|png" -q 95 "D:/photos"
  pnpm convert webp "./photos/**/*.HEIC" "./other/photo.CR3"

폴더는 하위까지 탐색합니다. glob은 따옴표로 감싸세요.
결과는 원본 옆의 out 폴더에 저장합니다. 같은 이름은 번호를 붙입니다.
지원되는 원본 메타데이터를 복사하고 회전·크기 정보는 결과에 맞게 갱신합니다.
폴더·glob 탐색 시 out, node_modules, .git 폴더는 제외합니다.`;

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`${error.message}\n\n${usage}`);
    process.exitCode = 1;
    return;
  }
  if (options.help) {
    console.log(usage);
    return;
  }
  const { formats, inputs, quality } = options;
  if (formats.includes('png') && quality !== undefined) {
    console.log('ℹ️ PNG는 무손실 압축이므로 -q를 적용하지 않습니다.');
  }

  const { files, errors } = await collectInputs(inputs);
  for (const error of errors) console.error(`❌ ${error}`);
  console.log(`🔍 ${files.length}개 이미지를 ${formats.join(', ')} 형식으로 변환합니다.`);
  const converter = createConverter();
  let converted = 0;
  let failed = errors.length;
  try {
    // 큰 RAW 이미지가 한꺼번에 메모리에 올라오지 않도록 순서대로 처리합니다.
    for (const file of files) {
      for (const format of formats) {
        try {
          const buffer = await converter.convert(file, format, quality);
          const output = await saveOutput(file, format, buffer);
          try {
            const warnings = await converter.preserveMetadata(file, output);
            for (const warning of warnings) console.warn(`⚠️ ${file} (${format}): ${warning}`);
          } catch (error) {
            // 이번 실행에서 새로 만든 결과만 정리하며 원본·기존 결과는 유지합니다.
            await fs.unlink(output);
            throw new Error(`메타데이터 복사 실패: ${error.message}`);
          }
          converted++;
          console.log(`✅ ${file} → ${output}`);
        } catch (error) {
          failed++;
          console.error(`❌ ${file} (${format}): ${error.message}`);
        }
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
