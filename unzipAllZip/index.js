import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';

function openOutput(directory, name) {
  const { name: stem, ext } = path.parse(name);
  for (let counter = 0; ; counter += 1) {
    const filename = counter === 0 ? name : `${stem}-${counter}${ext}`;
    const output = path.join(directory, filename);
    try {
      return { output, descriptor: fs.openSync(output, 'wx') };
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
}

function extractZip(zipFilePath) {
  const zip = new AdmZip(zipFilePath);
  const directory = path.dirname(zipFilePath);
  const written = [];

  try {
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) {
        continue;
      }

      const name = path.posix.basename(entry.entryName.replace(/\\/g, '/'));
      const windowsInvalidName = process.platform === 'win32' && (
        /[<>:"|?*\x00-\x1f]|[ .]$/.test(name) ||
        /^(?:CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[1-9¹²³]|LPT[1-9¹²³]) *(?:\.|$)/i.test(name)
      );
      if (!name || name === '.' || name === '..' || windowsInvalidName) {
        throw new Error(`저장할 수 없는 파일 이름: ${entry.entryName}`);
      }

      const data = entry.getData();
      if (data.length !== entry.header.size) {
        throw new Error(`추출 결과를 확인할 수 없습니다: ${entry.entryName}`);
      }

      const { output, descriptor } = openOutput(directory, name);
      written.push(output);
      try {
        fs.writeFileSync(descriptor, data);
      } finally {
        fs.closeSync(descriptor);
      }
    }
    fs.unlinkSync(zipFilePath);
  } catch (error) {
    for (const output of written) {
      try {
        fs.unlinkSync(output);
      } catch (cleanupError) {
        console.error(`❌ 추출 파일 정리 실패: ${output} (${cleanupError.message})`);
      }
    }
    throw error;
  }
}

function extractZipFiles(inputDir) {
  const files = [];
  const directories = [path.resolve(inputDir)];
  while (directories.length > 0) {
    const directory = directories.pop();
    try {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          directories.push(entryPath);
        } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.zip') {
          files.push(entryPath);
        }
      }
    } catch (error) {
      console.error(`❌ 폴더를 읽을 수 없습니다: ${directory} (${error.message})`);
      process.exitCode = 1;
    }
  }

  if (files.length === 0 && process.exitCode) {
    return;
  }
  console.log(`🔍 ${files.length}개 ZIP 파일을 처리합니다.`);
  let failed = 0;

  for (const zipFilePath of files.sort()) {
    console.log(`🚀 추출 시작: ${zipFilePath}`);

    try {
      extractZip(zipFilePath);
      console.log(`✅ 추출 완료: ${zipFilePath}`);
    } catch (error) {
      failed += 1;
      console.error(`❌ 처리 실패: ${zipFilePath} (${error.message})`);
    }
  }

  if (failed > 0) {
    console.error(`❌ ${failed}개 ZIP 파일 처리 실패. 실패한 ZIP 파일은 다시 확인하세요.`);
    process.exitCode = 1;
  } else if (!process.exitCode) {
    console.log('🙆‍♀️ 모든 ZIP 파일 추출 완료!');
  }
}

function main(args) {
  const usage = '사용법: pnpm extractZips <폴더>';
  if (args.length === 1 && ['-h', '--help'].includes(args[0])) {
    console.log(usage);
  } else if (args.length === 1 && args[0]) {
    extractZipFiles(args[0]);
  } else {
    console.error(usage);
    process.exitCode = 1;
  }
}

main(process.argv.slice(2));
