import fs from 'fs/promises';
import path from 'path';
import heicConvert from 'heic-convert';
import sharp from 'sharp';

async function convertHeicToWebp(inputPath, outputPath) {
  // 1단계: HEIC -> PNG 변환 (무손실)
  const inputBuffer = await fs.readFile(inputPath);
  const pngBuffer = await heicConvert({
    buffer: inputBuffer,
    format: 'PNG',      // PNG로 변환
    quality: 1          // 최대 품질
  });

  // 2단계: PNG -> WebP 변환
  await sharp(pngBuffer)
    .webp({
      quality: 85,      // 85% 품질 (시각적으로 거의 차이 없음)
      lossless: false,  // 손실 압축 사용
      effort: 6,        // 최대 압축 효율
      nearLossless: true // 거의 무손실에 가까운 압축 사용
    })
    .toFile(outputPath);
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

  const conversionPromises = files.map(async (file) => {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, `${path.parse(file).name}.webp`);
    try {
      await convertHeicToWebp(inputPath, outputPath);
      console.log(`✅ 변환 완료: ${outputPath}`);
    } catch (err) {
      console.error(`❌ 변환 실패: ${inputPath}`);
      console.error(err.message);
    }
  });

  await Promise.allSettled(conversionPromises);

  console.log('🚀 모든 HEIC → WebP 변환 완료');
}

main();
