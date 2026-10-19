# 유틸리티 모음

저장소 루트에서 의존성을 설치하고 각 도구를 실행합니다.

```powershell
pnpm install
pnpm cr3tojpeg "D:\photos\raw"
pnpm heicToPng "D:\photos\heic"
pnpm unzipAllZip "D:\photos\zip"
pnpm sleepSort 10
```

| 루트 명령 | 실행 내용 |
| --- | --- |
| `pnpm cr3tojpeg <폴더>` | `cr3tojpeg`의 `convert`: CR3 → JPEG |
| `pnpm heicToPng <폴더>` | `heicToPng`의 `convert`: HEIC → WebP |
| `pnpm unzipAllZip <폴더>` | `unzipAllZip`의 `extract`: ZIP에서 HEIC 추출 후 처리한 ZIP 삭제 |
| `pnpm grabOutFiles` | `grabOutFiles/index.js`: 코드에 지정된 `D:/1`의 파일을 `D:/2`로 이동 |
| `pnpm sleepSort <숫자>` | `sleepSort/index.js` 실행 |

변환·추출 명령은 각 패키지 폴더에서 기존 스크립트를 실행합니다. 상대 경로도 해당 패키지 폴더를 기준으로 해석되므로, 입력 폴더는 위 예시처럼 절대 경로로 지정하는 것을 권장합니다.

`grabOutFiles`는 실행 전에 소스 코드에 지정된 원본·대상 경로를 확인하세요. 파일을 이동하고 비워진 원본 폴더를 삭제합니다.

기존 ZIP 추출 테스트는 루트에서 `pnpm test`로 실행합니다.

PowerShell 실행 정책 때문에 `pnpm.ps1` 실행이 차단되면 같은 명령을 `pnpm.cmd`로 실행할 수 있습니다.
