# 유틸리티 모음

저장소 루트에서 의존성을 설치하고 각 도구를 실행합니다.

```powershell
pnpm install
pnpm convert jpg "D:\photos\raw"
pnpm convert webp "D:\photos\heic"
pnpm convert png "./photos/**/*.{cr3,CR3,heic,HEIC}" "./other/photo.jpg"
pnpm unzipAllZip "D:\photos\zip"
pnpm sleepSort 10
```

| 루트 명령 | 실행 내용 |
| --- | --- |
| `pnpm convert <출력 형식> <경로...>` | 통합 이미지 변환기: 파일·폴더·glob을 여러 개 지정 가능 |
| `pnpm cr3tojpeg <경로...>` | `pnpm convert jpeg`의 호환 명령 |
| `pnpm heicToPng <경로...>` | `pnpm convert webp`의 호환 명령 |
| `pnpm unzipAllZip <폴더>` | `unzipAllZip`의 `extract`: ZIP에서 HEIC 추출 후 처리한 ZIP 삭제 |
| `pnpm grabOutFiles` | `grabOutFiles/index.js`: 코드에 지정된 `D:/1`의 파일을 `D:/2`로 이동 |
| `pnpm sleepSort <숫자>` | `sleepSort/index.js` 실행 |

## 이미지 변환

`convert` 패키지가 기존 CR3·HEIC 변환기를 통합합니다. 상대 경로는 명령을 실행한 폴더 기준으로 해석합니다. 위 예시는 모두 저장소 루트에서 실행합니다.

- 입력: CR3, HEIC/HEIF, JPEG, PNG, WebP, AVIF, TIFF, GIF. 확장자의 대소문자를 구분하지 않습니다.
- 출력: `jpg`/`jpeg`, `png`, `webp`, `avif`, `tif`/`tiff`. GIF 등 여러 프레임이 있는 입력은 첫 이미지 한 장을 변환합니다.
- 폴더를 지정하면 모든 하위 폴더의 지원 이미지를 탐색합니다.
- glob은 `"./photos/**/*"`, `"./photos/**/*.HEIC"`처럼 따옴표로 감쌉니다. 패턴 자체의 대소문자는 구분하므로 혼합 확장자는 `*.{heic,HEIC}`처럼 지정하세요.
- 폴더·glob 탐색에서는 `out`, `node_modules`, `.git` 폴더와 심볼릭 링크를 통한 폴더 탐색을 제외합니다. 중복으로 선택된 파일은 한 번만 처리합니다.
- 각 원본 폴더의 `out`에 저장합니다. 예: `photos/trip/a.CR3` → `photos/trip/out/a.jpg`. 이름이 겹치거나 기존 결과가 있으면 `a-1.jpg`, `a-2.jpg`처럼 번호를 붙입니다. 원본과 기존 결과는 덮어쓰지 않습니다.
- CR3는 RAW 현상 대신 카메라가 저장한 내장 JPEG를 추출해 변환하며, 원본 방향 정보를 적용합니다. 일반 이미지도 EXIF 방향을 적용합니다. 출력 파일의 메타데이터는 제거됩니다.
- 입력별로 이미지가 없거나 변환이 실패하면 오류를 출력하고 나머지 파일을 계속 처리합니다. 오류가 하나라도 있으면 종료 코드는 `1`입니다.

`pnpm convert --help`로 사용법을 볼 수 있습니다. 기존 `cr3tojpeg`, `heicToPng` 명령도 통합 변환기에 연결되며, 이제 경로는 루트 기준이고 폴더 내 모든 지원 이미지가 대상입니다.

`unzipAllZip`은 해당 패키지 폴더에서 실행되므로 입력 폴더를 절대 경로로 지정하는 것을 권장합니다.

`grabOutFiles`는 실행 전에 소스 코드에 지정된 원본·대상 경로를 확인하세요. 파일을 이동하고 비워진 원본 폴더를 삭제합니다.

변환기와 ZIP 추출 테스트는 루트에서 `pnpm test`로 실행합니다.

PowerShell 실행 정책 때문에 `pnpm.ps1` 실행이 차단되면 같은 명령을 `pnpm.cmd`로 실행할 수 있습니다.
