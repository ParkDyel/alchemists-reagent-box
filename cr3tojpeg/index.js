// index.js
import fs from 'fs';
import path from 'path';
import { exiftool } from 'exiftool-vendored';
import sharp from 'sharp';

const orientationToDegrees = {
  3: 180,
  6: 90,
  8: 270,
};

async function extractAndRotate(cr3Path, outputPath) {
  try {
    const tempJpgPath = outputPath.replace('.jpg', '_temp.jpg');

    // 1. 추출
    await exiftool.extractBinaryTag('JpgFromRaw', cr3Path, tempJpgPath);

    // 2. Orientation 정보 읽기
    const tags = await exiftool.read(cr3Path);
    const orientation = tags.Orientation;

    // 3. sharp로 회전 적용 + 저장
    let image = sharp(tempJpgPath);

    if (orientationToDegrees[orientation] !== undefined) {
      image = image.rotate(orientationToDegrees[orientation]);
    }

    await image
      .toFile(outputPath)
    fs.unlinkSync(tempJpgPath); // 임시 파일 삭제

    console.log(`✅ 변환 + 회전 완료: ${outputPath}`);
  } catch (err) {
    console.error(`❌ 실패: ${cr3Path}`);
    console.error(err.message);
    try {
      console.log(`🚧 CR3 파일 삭제 완료: ${outputPath}`);
      fs.unlinkSync(tempJpgPath);
      fs.unlinkSync(outputPath); // CR3 파일 삭제
    } catch (unlinkErr) {
      console.error(`❌ 임시 파일 삭제 실패: ${unlinkErr.message}`);
    }
  }
}

async function main() {
  const inputDir = process.argv[2];

  if (!inputDir || !fs.existsSync(inputDir)) {
    console.error('❌ 유효한 폴더 경로를 입력하세요.');
    process.exit(1);
  }

  const outputDir = path.join(inputDir, 'out');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const files = fs.readdirSync(inputDir).filter(f => f.toLowerCase().endsWith('.cr3'));
  if (files.length === 0) {
    console.log('📁 CR3 파일이 없습니다.');
    return;
  }

  console.log(`🔍 ${files.length}개 파일을 변환합니다.`);

  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const base = path.parse(file).name;
    const outputPath = path.join(outputDir, `${base}.jpg`);
    await extractAndRotate(inputPath, outputPath);
  }

  await exiftool.end();
  console.log('🚀 모든 작업 완료!');
}

main();
