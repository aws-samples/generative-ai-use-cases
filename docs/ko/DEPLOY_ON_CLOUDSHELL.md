# AWS CloudShell을 사용한 배포 방법 (로컬 환경 준비가 어려운 경우)

## 배포 옵션 설정 방법

GenU에서는 다음 두 가지 방법으로 배포 옵션을 지정할 수 있습니다:

1. cdk.json의 context에서 지정
2. parameter.ts에서 지정 (여러 환경의 설정을 정의할 수 있어 새로운 빌드에 권장)

사용 가능한 배포 옵션은 [배포 옵션](./DEPLOY_OPTION.md)을 참조하세요.

### cdk.json에서 설정

[기본 cdk.json](/packages/cdk/cdk.json)을 다운로드하고 (GitHub 페이지 우측 상단의 다운로드 버튼에서 파일을 다운로드할 수 있습니다) context 섹션을 수정한 후 파일을 저장합니다.

### parameter.ts에서 설정

[기본 parameter.ts](/packages/cdk/parameter.ts)를 다운로드하고 필요한 환경 설정을 추가합니다. parameter.ts에서는 dev, staging, prod와 같은 여러 환경 설정을 하나의 파일에서 관리할 수 있습니다.

위의 기본 파일은 main 브랜치의 파일입니다. main 브랜치에 아직 릴리스되지 않은 변경사항이 있는 경우 배포할 릴리스의 파일을 다운로드하세요. [Releases 페이지](https://github.com/aws-samples/generative-ai-use-cases/releases)에서 태그를 선택한 후 파일을 열면 해당 릴리스의 파일을 가져올 수 있습니다.

## CloudShell 실행

[CloudShell](https://console.aws.amazon.com/cloudshell/home)을 실행합니다.
cdk.json이나 parameter.ts를 사용자 정의한 경우, 우측 상단의 Actions 메뉴에서 Upload file을 통해 사용자 정의된 파일을 업로드합니다.

## deploy.sh 다운로드 및 실행 권한 부여

CloudShell에서 다음 명령을 실행하여 `deploy.sh` 스크립트를 다운로드합니다.
다운로드 후 deploy.sh에 실행 권한을 부여합니다.

```bash
wget https://raw.githubusercontent.com/aws-samples/generative-ai-use-cases/refs/heads/main/deploy.sh -O deploy.sh
chmod +x deploy.sh
```

## deploy.sh 실행

deploy.sh는 다음 옵션을 지원합니다:

```bash
-c, --cdk-context    ... cdk.json 파일 경로
-p, --parameter-file ... parameter.ts 파일 경로
-e, --env           ... 환경 이름 (예: dev, prod)
-r, --ref           ... 배포할 Git 태그 또는 브랜치 (기본값: 최신 릴리스)
-h, --help          ... 이 메시지 표시
```

### 배포 예제

다음 명령으로 deploy.sh를 실행합니다. --cdk-context 옵션은 사용자 정의된 cdk.json의 경로를 지정합니다. (--parameter-file의 경우 parameter.ts의 경로) 앞서 설명한 대로 수정 없이 파일을 업로드한 경우 이 경로가 사용됩니다. cdk.json이나 parameter.ts가 다른 경로에 있는 경우 인수 값을 적절히 수정하세요.

1. 기본 설정으로 배포:

```bash
./deploy.sh
```

2. 사용자 정의된 cdk.json을 사용하여 배포:

```bash
./deploy.sh --cdk-context ~/cdk.json
```

3. 사용자 정의된 parameter.ts를 사용하여 이름 없는 환경 배포:

```bash
./deploy.sh --parameter-file ~/parameter.ts
```

4. parameter.ts와 환경을 지정하여 배포:

```bash
./deploy.sh --parameter-file ~/parameter.ts --env prod
```

5. 특정 릴리스 또는 브랜치를 지정하여 배포 (지정하지 않으면 `deploy.sh`는 최신 릴리스를 배포합니다):

```bash
./deploy.sh --ref v5.6.0
./deploy.sh --ref main
```

배포가 완료되면 CloudFront URL이 표시됩니다. 해당 URL을 브라우저에서 열어 GenU에 액세스할 수 있습니다.

### 구성 우선순위

1. parameter.ts와 환경이 지정되고, 환경 이름(이름 없는 환경 포함)이 parameter.ts에 정의된 경우, 해당 설정이 최우선순위를 가집니다
2. 다음으로 cdk.json 설정이 적용됩니다

이러한 단계를 실행하려면 [Amazon Bedrock 모델 액세스](https://console.aws.amazon.com/bedrock/home#/modelaccess)에서 모델을 활성화해야 합니다.
구성 파일(parameter.ts 또는 cdk.json)의 modelRegion에서 modelIds, imageGenerationModelIds, videoGenerationModelIds, speechToSpeechModelIds에 지정된 모델이 활성화되어 있는지 확인하세요.
