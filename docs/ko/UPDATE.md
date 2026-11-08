# 업데이트 방법

GenU는 자주 업데이트됩니다.
기능 추가 및 개선 외에도 보안 관련 업데이트가 포함될 수 있으므로 정기적으로 최신 릴리스로 업데이트하고 재배포하는 것을 권장합니다.

각 릴리스는 Git 태그(예: `v5.6.0`)로 공개되며, [Releases 페이지](https://github.com/aws-samples/generative-ai-use-cases/releases)에 릴리스 노트가 게시됩니다.
main 브랜치에는 아직 릴리스되지 않은 변경사항도 포함되므로 main 브랜치가 아닌 릴리스를 배포하는 것을 권장합니다.

[AWS CloudShell을 사용한 배포 방법](./DEPLOY_ON_CLOUDSHELL.md)을 사용하는 경우, `deploy.sh`는 기본적으로 최신 릴리스를 배포하므로 `deploy.sh`를 다시 실행하기만 하면 업데이트할 수 있습니다. (다음 단계는 필요하지 않습니다.)

## 수동 업데이트 과정

사용자가 직접 업데이트하는 방법입니다.

### 릴리스 노트 확인

업데이트하기 전에 [Releases 페이지](https://github.com/aws-samples/generative-ai-use-cases/releases)에서 현재 버전부터 새 버전까지의 모든 릴리스 노트를 확인하세요.
호환성이 깨지는 변경(리소스 교체 또는 삭제, 설정 항목 삭제 또는 이름 변경 등)이 포함된 릴리스의 경우 릴리스 노트에 영향과 마이그레이션 절차가 기재되어 있습니다.

다음 명령으로 현재 버전을 확인할 수 있습니다:

```bash
git describe --tags
```

### 최신 릴리스 병합

이미 저장소를 복제하고 초기 배포를 완료했다고 가정합니다.
[cdk.json](/packages/cdk/cdk.json)이나 [parameter.ts](/packages/cdk/parameter.ts) 등의 파일을 변경한 경우에는 먼저 자신의 브랜치에 커밋하세요.

다음 명령으로 릴리스를 가져와 최신 릴리스를 자신의 브랜치에 병합합니다:

```bash
git fetch --tags origin
git merge $(git describe --tags --abbrev=0 origin/main)
```

특정 릴리스로 업데이트하려면 해당 태그를 지정합니다:

```bash
git merge v5.6.0
```

자신의 커밋이 없는 경우 병합은 fast-forward로 처리되며 코드는 릴리스와 같은 상태가 됩니다.
자신의 커밋이 있는 경우 병합 커밋이 생성되고 커밋 메시지를 편집하는 에디터가 열립니다. 메시지를 변경하지 않으려면 `--no-edit`를 붙여 실행할 수 있습니다:

```bash
git merge --no-edit v5.6.0
```

이전에 main 브랜치를 pull하여 업데이트한 경우, 코드에 최신 릴리스보다 새로운 변경사항이 이미 포함되어 있을 수 있습니다.
이 경우 위의 병합으로는 아무것도 변경되지 않으며, 다음 릴리스를 병합하면 릴리스 내용과 일치하게 됩니다.

### 다른 저장소에서 사용자 정의하는 경우

다른 저장소(fork 등)에서 사용자 정의하는 경우 원격이 다른 이름으로 등록되어 있을 수 있습니다.
다음 명령으로 원격을 확인할 수 있습니다:

```bash
git remote -v
```

아래 예제 출력에서 aws-samples Organization에서 관리하는 저장소(원본 저장소)가 "aws"라는 이름으로 등록되어 있습니다.

```
origin  https://my-private-git-hosting-site.com/myawesomeorg/generative-ai-use-cases (fetch)
origin  https://my-private-git-hosting-site.com/myawesomeorg/generative-ai-use-cases (push)
aws     https://github.com/aws-samples/generative-ai-use-cases (fetch)
aws     https://github.com/aws-samples/generative-ai-use-cases (push)
```

이 경우 "aws"를 명시적으로 지정합니다:

```bash
git fetch --tags aws
git merge $(git describe --tags --abbrev=0 aws/main)
```

`git remote -v` 결과에 aws-samples에서 관리하는 저장소가 표시되지 않으면 다음 명령으로 추가합니다:

```bash
git remote add aws https://github.com/aws-samples/generative-ai-use-cases
```

릴리스 태그 병합은 그 시점의 main 브랜치를 병합하는 것과 동일하게 동작하므로, 사용자 정의는 자신의 브랜치에 유지한 채 릴리스마다 병합할 수 있습니다.
특정 변경사항만 필요한 경우 main 브랜치에서 해당 커밋을 cherry-pick할 수도 있습니다.

### 변경사항을 통합하기 전에 확인하고 싶은 경우

병합하기 전에 변경사항을 확인하려면 자신의 코드와 릴리스를 비교합니다:

```bash
git diff HEAD v5.6.0
```

### 충돌이 발생하는 경우

병합 중에 충돌이 발생하면 사용자 정의 코드와 원본 변경사항이 동시에 같은 파일을 수정했다는 의미입니다.
충돌이 있는 코드는 수동으로 수정해야 합니다.

[cdk.json](/packages/cdk/cdk.json)의 충돌에 특히 주의하세요.
**병합 후에는 항상 확인하여 로컬에서 구성한 항목이 손실되지 않았는지 확인하세요.**

`package-lock.json`의 충돌은 수동으로 수정하지 말고, 원본 저장소의 내용을 채택한 후 다시 생성하세요:

```bash
git checkout --theirs package-lock.json
npm install
git add package-lock.json
```

### 설정을 cdk.json에서 parameter.ts로 옮기는 경우

[parameter.ts](/packages/cdk/parameter.ts)의 `envs`에 환경을 정의하면 해당 환경에서는 [cdk.json](/packages/cdk/cdk.json)의 매개변수가 사용되지 않으며, parameter.ts에 작성하지 않은 항목은 기본값이 됩니다. 옮길 때는 다음 사항에 주의하세요.

- cdk.json에서 기본값을 변경한 매개변수는 모두 옮기세요. 누락된 항목은 기본값으로 돌아갑니다. 예를 들어 `ragKnowledgeBaseEnabled: true`가 누락되면 Knowledge Base 스택이 삭제됩니다.
- 환경 이름(`env`)은 변경하지 마세요. 환경 이름은 스택 이름에 포함되므로 변경하면 다른 스택이 생성됩니다. `-c env=` 없이 배포하는 경우 `''` 환경으로 정의합니다.
- parameter.ts에는 `dev`, `staging`, `prod`가 빈 상태로 정의되어 있습니다. 이 환경 이름으로 배포하는 경우 cdk.json의 매개변수는 이미 사용되지 않습니다.
- 옮긴 후 `npm run cdk:diff`를 실행하여 옮기기 전과 같은 변경사항만 표시되는지 확인한 후 재배포하세요.

### 문제 해결

| 표시되는 메시지                                                           | 원인과 해결 방법                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Your local changes to the following files would be overwritten by merge` | 커밋하지 않은 변경사항이 있습니다. `git commit`으로 자신의 브랜치에 커밋하거나 `git stash`로 임시 저장한 후 다시 병합하세요.                                                                                                              |
| `CONFLICT (content): Merge conflict in ...`                               | [충돌이 발생한 경우](#충돌이-발생하는-경우)를 참조하세요. 병합을 취소하고 다시 시작하려면 `git merge --abort`를 실행합니다. 병합 전 상태로 돌아갑니다.                                                                                    |
| `merge: v5.6.0 - not something we can merge`                              | 태그를 가져오지 않았거나 태그 이름이 잘못되었습니다. `git fetch --tags origin`(다른 이름의 원격인 경우 그 이름)을 실행하고 [Releases 페이지](https://github.com/aws-samples/generative-ai-use-cases/releases)에서 태그 이름을 확인하세요. |
| `fatal: No names found, cannot describe anything.`                        | `git clone --depth 1` 등으로 기록을 생략하고 clone했기 때문에 태그가 없습니다. `git fetch --tags --unshallow origin`을 실행한 후 다시 시도하세요.                                                                                         |
| `Already up to date.`                                                     | 이미 해당 릴리스 또는 그보다 새로운 main 브랜치의 내용이 포함되어 있습니다. 오류가 아닙니다.                                                                                                                                              |
| `fatal: destination path 'generative-ai-use-cases' already exists`        | 같은 이름의 디렉토리가 이미 있습니다. 기존 디렉토리에서 업데이트하거나 다른 이름으로 clone하세요(`git clone <URL> <디렉토리 이름>`).                                                                                                      |

충돌 해결을 Kiro 등의 AI 코딩 어시스턴트에 맡길 수도 있습니다. 이 경우에도 병합 후 [cdk.json](/packages/cdk/cdk.json)과 [parameter.ts](/packages/cdk/parameter.ts)에서 설정한 항목이 남아 있는지 반드시 확인하세요.

### main 브랜치 사용

아직 릴리스되지 않은 변경사항이 필요한 경우 릴리스 대신 main 브랜치를 병합할 수 있습니다:

```bash
git fetch origin
git merge origin/main
```

main 브랜치에는 아직 릴리스 노트에 기재되지 않은 변경사항(호환성이 깨지는 변경 포함)이 포함될 수 있습니다.

### 재배포

기본적으로 [README.md](/README.md)의 단계를 따르지만 Bootstrap은 필요하지 않습니다.
패키지가 업데이트되었을 수 있으므로 `npm ci` 명령을 실행하세요:

```bash
npm ci
npm run cdk:deploy
```

## 업데이트 자동화

AWS에서 업데이트를 자동화하는 방법도 있습니다.
다음 기사에서는 AWS CodePipeline과 통합하여 GitHub에서 두 번의 클릭만으로 업데이트하는 방법을 소개합니다:  
[GenU를 번개처럼 빠르게 업데이트! AWS CodePipeline을 사용한 원클릭 업데이트 기법](https://qiita.com/moritalous/items/9ade46091a60030415e0) by [@moritalous](https://x.com/moritalous)
