import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';

function extractHeicFiles(zipFilePath, inputDir) {
  const zip = new AdmZip(zipFilePath);

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory || !entry.entryName.toLowerCase().endsWith('.heic')) {
      continue;
    }

    // extractEntryTo() can report success even if its internal write was skipped.
    const outputName = path.posix.basename(entry.entryName.replace(/\\/g, '/'));
    const outputPath = path.join(inputDir, outputName);
    const extracted = zip.extractEntryTo(entry, inputDir, false, true);
    const outputStat = fs.statSync(outputPath);

    if (!extracted || !outputStat.isFile() || outputStat.size !== entry.header.size) {
      throw new Error(`추출 결과를 확인할 수 없습니다: ${entry.entryName}`);
    }
  }
}

function main() {
  const inputDir = process.argv[2];

  if (!inputDir) {
    console.error('❌ 유효한 폴더 경로를 입력하세요.');
    process.exitCode = 1;
    return;
  }

  let files;
  try {
    if (!fs.statSync(inputDir).isDirectory()) {
      throw new Error('폴더가 아닙니다.');
    }
    files = fs.readdirSync(inputDir, { withFileTypes: true })
      .filter(file => file.isFile() && path.extname(file.name).toLowerCase() === '.zip')
      .map(file => file.name);
  } catch (error) {
    console.error(`❌ 폴더를 읽을 수 없습니다: ${inputDir} (${error.message})`);
    process.exitCode = 1;
    return;
  }

  console.log(`🔍 ${files.length}개 ZIP 파일을 처리합니다.`);
  let failed = 0;

  for (const zipFile of files) {
    const zipFilePath = path.join(inputDir, zipFile);
    console.log(`🚀 추출 시작: ${zipFilePath}`);

    try {
      extractHeicFiles(zipFilePath, inputDir);
      fs.unlinkSync(zipFilePath);
      console.log(`✅ 추출 완료: ${zipFilePath}`);
    } catch (error) {
      failed += 1;
      console.error(`❌ 처리 실패: ${zipFilePath} (${error.message})`);
    }
  }

  if (failed > 0) {
    console.error(`❌ ${failed}개 ZIP 파일 처리 실패. 실패한 ZIP 파일은 다시 확인하세요.`);
    process.exitCode = 1;
  } else {
    console.log('🙆‍♀️ 모든 ZIP 파일 추출 완료!');
  }
}

main();
