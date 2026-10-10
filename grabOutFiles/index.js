const fs = require("fs");
const path = require("path");

// 함수 정의: 폴더 안의 모든 파일을 폴더 밖으로 이동시키는 재귀 함수
function moveFilesRecursive(sourceDir, targetDir) {
  // sourceDir과 targetDir 경로를 절대 경로로 변환
  sourceDir = path.resolve(sourceDir);
  targetDir = path.resolve(targetDir);

  // sourceDir의 내용을 읽음
  const contents = fs.readdirSync(sourceDir);

  contents.forEach((item) => {
    const itemPath = path.join(sourceDir, item);
    const targetPath = path.join(targetDir, item);

    // 파일 또는 폴더의 상태를 가져옴
    const stat = fs.statSync(itemPath);

    if (stat.isFile()) {
      // 파일인 경우, targetDir로 이동
      fs.renameSync(itemPath, targetPath);
      console.log(`Moved file: ${itemPath} to ${targetPath}`);
    } else if (stat.isDirectory()) {
      // 폴더인 경우, 재귀적으로 해당 폴더 안의 파일들을 targetDir로 이동
      moveFilesRecursive(itemPath, targetDir);
    }
  });

  // 모든 파일 및 폴더 이동 완료 후, sourceDir 폴더 삭제 (옵션)
  if (sourceDir !== path.resolve(__dirname)) {
    fs.rmdirSync(sourceDir);
    console.log(`Deleted folder: ${sourceDir}`);
  }
}

// 사용 예시: moveFilesRecursive('원본폴더 경로', '목표폴더 경로');
moveFilesRecursive("D:/1", "D:/2");
