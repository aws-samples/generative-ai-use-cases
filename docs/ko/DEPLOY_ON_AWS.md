# (사용 중단) AWS에서 완전히 배포하는 방법 (로컬 환경 설정이 어려운 경우)

> [!Caution]
> AWS Cloud9가 신규 고객에 대한 액세스를 종료함에 따라 이 절차는 사용 중단되었습니다.
> AWS에서 완전히 완료할 수 있는 배포 방법은 [CloudShell을 사용한 배포 방법](./DEPLOY_ON_CLOUDSHELL.md)을 참조하세요.
> AWS Cloud9에서의 마이그레이션은 [이 블로그](https://aws.amazon.com/jp/blogs/news/how-to-migrate-from-aws-cloud9-to-aws-ide-toolkits-or-aws-cloudshell/)를 참조하세요.

AWS CloudShell과 AWS Cloud9를 사용하여 로컬 환경에 의존하지 않고 배포할 수 있습니다. (배포가 AWS에서 완전히 완료됩니다.)

## Cloud9 환경 생성

[cloud9-setup-for-prototyping](https://github.com/aws-samples/cloud9-setup-for-prototyping)을 사용합니다. cloud9-setup-for-prototyping으로 생성된 환경은 기본 Cloud9 환경과 달리 메모리 및 스토리지 부족, 권한 부족과 같은 일반적인 문제를 해결합니다. [AWS CloudShell](https://console.aws.amazon.com/cloudshell/home)을 열고 [cloud9-setup-for-prototyping의 README.md](https://github.com/aws-samples/cloud9-setup-for-prototyping)의 지침에 따라 Cloud9 환경을 생성합니다. 아래는 실행할 명령만 나열한 것입니다. 자세한 내용은 README.md를 확인하세요.

```bash
git clone https://github.com/aws-samples/cloud9-setup-for-prototyping
cd cloud9-setup-for-prototyping
./bin/bootstrap
```

생성이 완료되면 [AWS Cloud9](https://console.aws.amazon.com/cloud9control/home)에서 cloud9-for-prototyping이라는 환경을 볼 수 있습니다. Open을 클릭하여 IDE를 실행합니다.
다음의 모든 단계는 생성된 IDE에서 수행됩니다.

## generative-ai-use-cases 배포

IDE 하단의 Terminal에서 다음 명령을 실행합니다. 이렇게 하면 generative-ai-use-cases를 복제하고 작업 디렉토리로 이동합니다.

```bash
git clone https://github.com/aws-samples/generative-ai-use-cases
cd generative-ai-use-cases/
git switch -c genu $(git describe --tags --abbrev=0)
```

그런 다음 [generative-ai-use-cases의 README.md](/README.md#deployment)의 지침을 따릅니다. 아래는 실행할 명령만 나열한 것입니다.

```bash
npm ci
npx -w packages/cdk cdk bootstrap # CDK Bootstrap이 필요한 경우에만 (여러 번 실행해도 문제없음)
npm run cdk:deploy
```

## 배포 옵션 변경

`cloud9-for-prototyping/generative-ai-use-cases/packages/cdk/cdk.json`을 열고 context의 항목을 수정합니다. 구성 가능한 옵션은 [여기](./DEPLOY_OPTION.md)를 참조하세요.

cdk.json의 내용을 변경한 후 파일을 저장하고 `npm run cdk:deploy`를 실행합니다. 배포 시 구성 변경사항이 적용됩니다.

## 프론트엔드 개발

Cloud9의 Preview 기능을 사용하려면 localhost의 8080~8082 포트에서 수신해야 합니다. ([참조](https://docs.aws.amazon.com/ja_jp/cloud9/latest/user-guide/app-preview.html)) generative-ai-use-cases의 프론트엔드 개발에 사용되는 [Vite](https://ja.vitejs.dev/)는 기본적으로 포트 5173을 사용하므로 이를 변경해야 합니다.

`cloud9-for-prototyping/generative-ai-use-cases/packages/web/package.json`을 열고 scripts의 dev 명령을 `vite`에서 `vite --port 8080`으로 변경합니다. 변경 후 package.json의 일부는 다음과 같습니다. (vite.config.ts에서도 포트를 설정할 수 있지만 여기서는 다루지 않습니다.)

```json
{
  "name": "web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 8080",
  ... 생략
```

변경 후 파일을 저장합니다. 다음으로 후속 명령에서 내부적으로 사용되는 `jq`를 설치합니다.

```bash
sudo yum -y install jq
```

그런 다음 [여기](./DEVELOPMENT.md)의 지침을 따릅니다. 다음 명령을 실행합니다:

```bash
npm run web:devw
```

실행 후 IDE 상단의 Preview를 클릭한 다음 Preview Running Application을 클릭합니다. 그러면 IDE 내에 브라우저가 표시됩니다. 프론트엔드 코드를 변경하면 변경사항이 화면에 실시간으로 적용됩니다. IDE 내 브라우저의 우측 상단에 "새 창에서 열기" 아이콘 버튼이 있습니다. 이를 클릭하면 Preview를 별도의 브라우저 탭에서 열 수 있습니다. 별도 탭에서 연 후에는 IDE 내 브라우저를 닫을 수 있습니다.
