# ZIP 추출

지정한 폴더와 그 하위 폴더의 ZIP을 각각 ZIP이 있던 위치에 풉니다.

## 사용법

저장소 루트에서 의존성을 설치한 뒤 실행합니다.

```powershell
pnpm install
pnpm extractZips "C:\사진\압축파일"
```

`unzipAllZip` 폴더에서 Node.js 18 이상으로 직접 실행할 수도 있습니다.

```powershell
npm ci
npm run extractZips -- "C:\사진\압축파일"
```

ZIP 확장자의 대소문자를 구분하지 않습니다. 하위 폴더 탐색에서 심볼릭 링크를 건너뜁니다. ZIP 안의 모든 파일을 내부 폴더 구조 없이 ZIP과 같은 폴더에 저장합니다. 이름이 겹치면 `photo-1.jpg`, `photo-2.jpg`처럼 번호를 붙입니다.

모든 파일을 저장한 ZIP은 삭제합니다. 비어 있는 ZIP도 처리 완료로 간주합니다. 처리에 실패하면 해당 ZIP은 남기고 이번에 그 ZIP에서 만든 파일을 정리한 뒤 다음 ZIP을 처리합니다. 폴더 탐색이나 추출에 실패하면 종료 코드는 `1`입니다.

## 테스트

```powershell
npm test
```
