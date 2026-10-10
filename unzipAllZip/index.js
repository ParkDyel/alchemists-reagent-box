import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

async function main() {
  const inputDir = process.argv[2];

  if (!inputDir || !fs.existsSync(inputDir)) {
    console.error('❌ 유효한 폴더 경로를 입력하세요.');
    process.exit(1);
  }

  const files = fs.readdirSync(inputDir).filter(file => path.extname(file).toLowerCase() === ".zip");

  console.log(`🔍 ${files.length}개 파일을 변환합니다.`);
  files.forEach((zipFile) => {

    const zipFilePath = path.join(inputDir, zipFile);
    const extractPath = inputDir; // 압축 해제할 경로 (ZIP 파일과 동일한 폴더)
    console.log(`🚀 추출 시작: ${zipFilePath}`);

    // ZIP 파일 열기
    const zip = new AdmZip(zipFilePath);

    // ZIP 파일 내 항목들 가져오기
    const zipEntries = zip.getEntries();

    zipEntries.forEach((entry) => {
      // HEIC 파일만 추출
      if (entry.entryName.toLowerCase().endsWith(".heic")) {
        zip.extractEntryTo(entry.entryName, extractPath, false, true); // 파일만 추출 (디렉토리는 제외)
      }
    });

    fs.unlinkSync(zipFilePath); // 파일 삭제
    console.log(`✅ 추출 완료: ${zipFilePath}`);
  });

  console.log('🙆‍♀️ 모든 ZIP 파일 추출 완료!');
}

main(); 