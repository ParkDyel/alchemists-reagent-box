import fs from 'fs/promises';
import path from 'path';
import heicConvert from 'heic-convert';

async function convertHeicToJpg(inputPath, outputPath) {
  const inputBuffer = await fs.readFile(inputPath);

  const outputBuffer = await heicConvert({
    buffer: inputBuffer, // the HEIC file buffer
    format: 'JPEG',      // output format
    quality: 0.85        // max quality (0~1)
  });

  await fs.writeFile(outputPath, outputBuffer);

}

async function main() {
  const inputDir = process.argv[2];
  if (!inputDir) {
    console.error('❌ 폴더 경로를 입력하세요.');
    process.exit(1);
  }

  const files = (await fs.readdir(inputDir)).filter(f => f.toLowerCase().endsWith('.heic'));
  console.log(`🔍 ${files.length}개 파일을 변환합니다.`);

  const outputDir = path.join(inputDir, 'out');
  await fs.mkdir(outputDir, { recursive: true });

  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, `${path.parse(file).name}.jpg`);
    try {
      await convertHeicToJpg(inputPath, outputPath);
      console.log(`✅ 변환 완료: ${outputPath}`);
    } catch (err) {
      console.error(`❌ 변환 실패: ${inputPath}`);
      console.error(err.message);
      continue;
    }
  }

  console.log('🚀 모든 HEIC → JPG 변환 완료');
}

main();
