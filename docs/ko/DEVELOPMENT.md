## 로컬 환경 설정 절차

개발자를 위한 로컬 환경 설정 절차를 설명합니다. 로컬 환경을 설정하는 경우에도 [AWS로의 배포](/README.md#deployment)가 완료되어야 합니다.

### (권장) Unix 기반 명령을 사용하는 사용자 (Cloud9, Linux, MacOS, Windows WSL/Bash/Git Bash 등)

다음 명령을 실행하면 CloudFormation Output에서 필요한 환경 변수를 동적으로 가져와 서버가 시작됩니다.
이는 내부적으로 `aws`와 `jq` 명령을 사용하므로, 설치되어 있지 않은 경우 실행 전에 설치하세요.

```bash
npm run web:devw
```

> [!TIP]
> AWS 인증에는 [기본 프로필](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html#cli-configure-files-using-profiles)이 사용됩니다.
> 인증에 다른 프로필이나 액세스 키를 사용하려면 환경 변수를 미리 설정하거나 [setup-env.sh](/setup-env.sh)에 추가하세요.
>
> ```bash
> export AWS_PROFILE=''
> export AWS_DEFAULT_REGION=''
> ```

> [!TIP]
> 다른 백엔드 환경으로 전환하여 사용하려면 cdk.json의 context.env를 변경하거나 `npm run web:devw --env=dev2`와 같이 명령줄 인수로 지정하세요.

> [!IMPORTANT]
> 배포된 API는 배포된 프런트엔드의 오리진에서 오는 요청만 받으므로, `allowedDevOrigins`에 로컬 오리진을 추가하고 배포하세요. 설정하지 않으면 브라우저 콘솔에 `No 'Access-Control-Allow-Origin' header is present on the requested resource`라는 CORS 오류가 표시되고, 대화 기록 저장 등의 API 호출이 실패합니다.
>
> ```typescript
> // packages/cdk/parameter.ts
> const envs: Record<string, Partial<StackInput>> = {
>   dev: {
>     allowedDevOrigins: ['http://localhost:5173'],
>   },
> };
> ```
>
> 스킴 + 호스트(+ 포트) 형식으로 지정하세요(끝의 슬래시나 경로를 포함하면 일치하지 않습니다). 프로덕션 환경에서는 설정하지 않는 것을 권장합니다.

### Windows 사용자

Windows 사용자를 위해 개발 환경을 설정하는 PowerShell 스크립트 `web_devw_win.ps1`을 준비했으며, `web:devww`(w가 하나 더 있음)로 실행할 수 있습니다. 이 스크립트는 `setup-env.sh`와 유사하지만 PowerShell에 맞게 조정되었으며, `aws` 명령은 필요하지만 `jq`는 필요하지 않습니다.

```bash
npm run web:devww
```

성공적으로 실행되면 http://localhost:5173에서 시작되므로 브라우저에서 액세스해 보세요. AWS 프로필은 `-profile`로 지정할 수 있지만, Windows에서 인수를 지정할 때는 `npm run web:devww '--' -profile dev`와 같이 `--`를 작은따옴표로 묶어주세요. 이는 `npm`의 알려진 문제입니다 ([Issue 3136](https://github.com/npm/cli/issues/3136#issuecomment-2632044780)).

### 기타 사용자

환경 변수를 수동으로 설정하는 것도 가능합니다. 하지만 변수가 많기 때문에 일반적으로 위에서 설명한 `npm run web:devw` 방법을 권장합니다.
수동으로 설정하는 경우 `/packages/web/.env`에 `.env` 파일을 생성하고 다음과 같이 환경 변수를 설정합니다:

```bash
VITE_APP_API_ENDPOINT=https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/api/
VITE_APP_REGION=ap-northeast-1
### 나머지 변수 생략 ###
```

필요한 환경 변수와 그 값은 [`setup-env.sh`](/setup-env.sh)와 CloudFormation Output 값(관리 콘솔에서)을 참조하세요.
환경 변수가 설정되면 다음 명령을 실행합니다:

```bash
npm run web:dev
```

성공적으로 실행되면 http://localhost:5173에서 시작되므로 브라우저에서 액세스해 보세요.

## Pull Request 제출 시

버그 수정 및 기능 개선을 위한 Pull Request를 환영합니다 :tada:

`git commit`이 실행되면 `npm run lint`가 실행됩니다. 하지만 실패하면 다음과 같은 오류로 커밋이 실패합니다:

```bash
⚠ Running tasks for staged files...
  ❯ package.json — 1 file
    ❯ **/* — 1 file
      ✖ sh -c 'npm run lint' [FAILED]
      ...
```

이 오류를 무시하고 Draft PR을 생성하려면 다음과 같이 `--no-verify` 옵션을 추가하세요.

```bash
git commit -m "xxx" --no-verify
```

또한 CDK에 변경사항이 있는 경우 다음 명령으로 스냅샷을 확인하고 업데이트하세요:

```bash
# 차이점 확인
npm run cdk:test

# 테스트 업데이트
npm run cdk:test:update-snapshot
```
