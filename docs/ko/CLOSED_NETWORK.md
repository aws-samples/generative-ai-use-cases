# 폐쇄 네트워크 모드

`closedNetworkMode` 옵션을 true로 설정하면 클라이언트에서 GenU로의 통신을 폐쇄 네트워크를 통해 활성화할 수 있습니다.
또한 GenU의 주요 컴퓨팅 리소스인 AWS Lambda와 다른 AWS 서비스(Amazon DynamoDB, Amazon S3, Amazon Bedrock 등) 간의 통신이 VPC 내에서 완료됩니다. 아키텍처 변경사항은 다음과 같습니다:

- Amazon CloudFront는 사용되지 않으며, 웹 정적 파일은 Application Load Balancer와 ECS Fargate에서 제공됩니다.
- Amazon Cognito는 Amazon API Gateway를 통해 액세스됩니다.
- Lambda 함수에서 다른 서비스로의 통신은 VPC 엔드포인트를 통해 수행됩니다.

폐쇄 네트워크 모드와 관련된 옵션은 `closedNetwork` 접두사를 가집니다. 다음은 옵션 목록입니다:

| 매개변수                                 | 설명                                                                                                                                                                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| closedNetworkMode                        | 폐쇄 네트워크 모드를 활성화할지 여부. true는 폐쇄 네트워크 모드를 활성화합니다. 기본값은 false입니다.                                                                                                                                                      |
| closedNetworkVpcIpv4Cidr                 | 새 VPC를 생성할 때 지정할 IPv4 CIDR. 기본값은 10.0.0.0/16입니다.                                                                                                                                                                                           |
| closedNetworkVpcId                       | 기존 VPC를 가져올 때의 VPC ID. 지정하지 않으면 새 VPC가 생성됩니다.                                                                                                                                                                                        |
| closedNetworkSubnetIds                   | GenU 관련 리소스가 배포될 여러 서브넷 ID를 지정합니다. ALB, Fargate 작업, VPC 엔드포인트, Resolver 엔드포인트가 생성됩니다. 지정하지 않으면 격리된 서브넷이 선택됩니다. 배열에 2개 이상의 서브넷 ID를 지정하세요.                                          |
| closedNetworkVpcEndpointAzs              | 인터페이스 VPC 엔드포인트를 생성할 AZ 배열 (예: `['ap-northeast-1a']`). 하나만 지정 시 비용 절감 (가용성 하락). 기본값 null은 전체 AZ. ALB 등 다른 리소스에는 영향 없음. `closedNetworkSubnetIds` 병용 시 둘 다 일치하는 서브넷만 사용.                    |
| closedNetworkApiGatewayVpcEndpointIds    | API Gateway 리소스 정책에서 추가로 허용할 VPC 엔드포인트 ID 배열입니다. GenU가 생성하는 API Gateway VPC 엔드포인트는 항상 허용됩니다. 다른 VPC나 다른 계정의 VPC 엔드포인트(예: 집약 VPC의 공유 엔드포인트)를 통해 API Gateway를 호출하는 경우 지정합니다. |
| closedNetworkCertificateArn              | GenU에 도메인을 할당할 때 지정할 ACM ARN. ACM은 수동으로 생성해야 합니다. 지정하지 않으면 GenU는 Application Load Balancer의 기본 엔드포인트로 게시됩니다.                                                                                                 |
| closedNetworkDomainName                  | GenU의 도메인 이름. Private Hosted Zone은 CDK에서 생성되므로 수동 생성이 필요하지 않습니다. `closedNetworkCertificateArn`과 `closedNetworkDomainName`은 함께 지정하거나 둘 다 생략해야 합니다.                                                             |
| closedNetworkCreateTestEnvironment       | 테스트 환경을 생성할지 여부. 기본적으로 생성됩니다. 필요하지 않으면 false를 지정하세요. 테스트 환경은 EC2 Windows 인스턴스로 생성되며 Fleet Manager를 통해 액세스됩니다. (자세한 절차는 나중에 설명됩니다.)                                                |
| closedNetworkTestEnvironmentInstanceType | 검증용 Windows 인스턴스의 인스턴스 유형. 기본값은 `r6i.large`. `t3.large` 등으로 지정하면 검증 환경 비용을 줄일 수 있음.                                                                                                                                   |
| closedNetworkAdditionalVpcEndpoints      | 활성화된 기능이 필요로 하지 않아도 생성할 Interface VPC Endpoint를 `closed-vpc.ts`의 이름으로 지정 (예: `['Kendra']`). 가져온 VPC(`closedNetworkVpcId`)의 다른 워크로드가 해당 VPC Endpoint를 사용하는 경우에 지정. 기본값은 `[]`.                         |
| closedNetworkCreateResolverEndpoint      | Route53 Resolver 엔드포인트를 생성할지 여부. 기본값은 true입니다.                                                                                                                                                                                          |

## 현재 제한사항

- 배포는 인터넷 연결이 있는 환경에서 수행해야 합니다. 또한 관리 콘솔에서 운영 검증 환경에 액세스할 때도 인터넷 연결이 필요합니다.
- 배포에는 일반 모드 배포와 동일한 환경이 필요합니다. 구체적으로 AWS IAM 사용자 구성, Node.js, Docker가 필요합니다.
- GenU가 배포되는 지역과 모델 지역이 동일해야 합니다. 현재 GenU를 ap-northeast-1에 배포하고 us-east-1의 모델을 사용하는 것은 불가능합니다.
- 다양한 리소스가 생성되므로 기존 VPC를 가져올 때는 가능한 한 깨끗한 환경을 사용하는 것이 좋습니다.
- SAML 통합은 사용할 수 없습니다.
- Voice Chat 사용 사례는 현재 사용할 수 없습니다.
- AgentCore (`agentBuilderEnabled` / `createGenericAgentCoreRuntime`)를 활성화하면 AgentCore Runtime이 폐쇄 네트워크 VPC 안에 배포되며, `agentCoreRegion`은 `region`과 같아야 합니다. Research Agent (`researchAgentEnabled`)는 런타임에 인터넷 연결이 필요하므로 폐쇄 네트워크 모드에서 활성화할 수 없습니다.
- AgentCore Runtime의 VPC 모드는 리전 내 일부 AZ만 지원합니다(예: us-east-1의 `use1-az1`, `use1-az2`, `use1-az4`). 런타임 생성에 실패하면 `closedNetworkSubnetIds`로 지원되는 AZ의 서브넷을 지정하세요.

## 폐쇄 네트워크 모드에서 사용할 수 있는 기능

폐쇄 네트워크 모드에서 동작하지 않는 설정은 `cdk synth` / `cdk deploy` 시 Warning으로 표시됩니다(ID는 `genu:closedNetwork:`로 시작). "숨김"으로 표시된 유스케이스는 UI에서 자동으로 숨겨집니다.

| 기능                                                                                                        | 지원      | 비고                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 채팅, 문장 생성, 요약, 집필, 번역, 다이어그램 생성, 영상 분석, 유스케이스 빌더                              | ✅        |                                                                                                                                                                              |
| 음성 인식, 회의록 생성                                                                                      | ✅        |                                                                                                                                                                              |
| RAG (Knowledge Base), RAG (Kendra)                                                                          | ✅        |                                                                                                                                                                              |
| Agent (Bedrock Agents), Flows                                                                               | ✅        |                                                                                                                                                                              |
| 이미지 생성, 동영상 생성                                                                                    | △         | `region`의 모델만 사용할 수 있습니다. 다른 리전의 모델은 표시되지 않으며, 남는 모델이 없으면 유스케이스가 숨겨집니다.                                                        |
| AgentCore (에이전트 빌더, 범용 런타임)                                                                      | △         | 폐쇄 네트워크 VPC 안에서 동작합니다. 인터넷이 필요한 도구(웹 검색, URL 가져오기, 외부 API를 호출하거나 실행 시 npm/PyPI에서 패키지를 가져오는 MCP 서버)는 동작하지 않습니다. |
| MCP 채팅                                                                                                    | △         | 인터넷이 필요한 MCP 서버는 동작하지 않습니다.                                                                                                                                |
| 음성 채팅                                                                                                   | ❌ (숨김) |                                                                                                                                                                              |
| 웹 콘텐츠 추출                                                                                              | △         | 폐쇄 네트워크 VPC에서 접근할 수 있는 페이지(사내 페이지 등)만 가져올 수 있습니다. 인터넷 페이지는 가져올 수 없습니다.                                                        |
| 검색 에이전트 (`searchAgentEnabled`)                                                                        | ❌        | 외부 검색 API를 호출합니다.                                                                                                                                                  |
| Research Agent (`researchAgentEnabled`)                                                                     | ❌ (오류) | 런타임에 인터넷 연결이 필요하므로 `closedNetworkMode`와 함께 활성화하면 `cdk synth`가 실패합니다.                                                                            |
| SAML 연동                                                                                                   | ❌        |                                                                                                                                                                              |
| `allowedIpV4AddressRanges` / `allowedIpV6AddressRanges` / `allowedCountryCodes` / `hostName` / `domainName` | ❌ (무시) | CloudFront와 WAF를 생성하지 않습니다. 사용자 지정 도메인은 `closedNetworkDomainName`을 사용하세요.                                                                           |

## 생성되는 VPC Endpoint

Interface형 VPC Endpoint는 엔드포인트별·AZ별로 과금되므로, 활성화한 기능에 필요한 것만 생성합니다. 기능을 비활성화하고 다시 배포하면 해당 VPC Endpoint는 삭제됩니다.

> [!WARNING]
> 기존 폐쇄 네트워크 환경을 업데이트하면 비활성화된 기능의 VPC Endpoint가 삭제됩니다. `closedNetworkVpcId`로 가져온 VPC의 다른 워크로드가 해당 VPC Endpoint(프라이빗 DNS 이름)를 사용하는 경우 배포 전에 `closedNetworkAdditionalVpcEndpoints`에 지정하세요.

| VPC Endpoint                                                                                                                                                  | 생성 조건                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `execute-api`, `lambda`, `cognito-idp`, `cognito-identity`, `s3` (Interface), `bedrock-runtime`, `bedrock-agent-runtime`, `ecr.api`, `ecr.dkr`, `logs`, `sts` | 항상                                                                                                       |
| `s3`, `dynamodb` (Gateway형, 무료)                                                                                                                            | 항상                                                                                                       |
| `transcribe`                                                                                                                                                  | 음성 인식 또는 회의록 생성을 숨기지 않음                                                                   |
| `transcribestreaming`                                                                                                                                         | 음성 인식, 회의록 생성, 번역 중 하나를 숨기지 않음                                                         |
| `polly`                                                                                                                                                       | 번역을 숨기지 않음                                                                                         |
| `bedrock-agentcore`                                                                                                                                           | `agentBuilderEnabled`, `createGenericAgentCoreRuntime`, `agentCoreExternalRuntimes` 중 하나                |
| `bedrock-agentcore.gateway`                                                                                                                                   | `agentBuilderEnabled` 또는 `agentCoreGatewayArns` (런타임 내 MCP 서버가 AgentCore Gateway를 호출하는 경우) |
| `bedrock-agent`                                                                                                                                               | `agentEnabled`, `searchAgentEnabled`, `agents` 중 하나                                                     |
| `kendra`                                                                                                                                                      | `ragEnabled`                                                                                               |
| `ssm`, `ssmmessages`, `ec2messages`                                                                                                                           | `closedNetworkCreateTestEnvironment`                                                                       |

## 고정비 목안

폐쇄 네트워크 모드에서 생성되는 리소스의 월 고정비입니다(730시간, AWS Price List API의 온디맨드 요금, 2026-11-10 기준). Amazon Bedrock, Lambda 등의 종량 과금, VPC Endpoint 데이터 처리 요금($0.01/GB), ALB LCU는 포함하지 않습니다. 최신 요금은 [AWS Pricing Calculator](https://calculator.aws/)에서 확인하세요.

| 리소스                                           | ap-northeast-1 | us-east-1 |
| ------------------------------------------------ | -------------- | --------- |
| Interface VPC Endpoint (엔드포인트 1개·AZ 1개당) | $10.22         | $7.30     |
| Route 53 Resolver 인바운드 엔드포인트 (ENI 2개)  | $182.50        | $182.50   |
| Application Load Balancer (시간 요금)            | $17.74         | $16.43    |
| 웹 앱용 Fargate 태스크 (0.25 vCPU / 0.5 GB × 1)  | $11.25         | $9.01     |
| 검증용 Windows 인스턴스 `r6i.large` + gp3 100 GB | $187.72        | $167.14   |
| 검증용 Windows 인스턴스 `t3.large` + gp3 100 GB  | $109.17        | $88.88    |

ap-northeast-1 구성 예(VPC 신규 생성, 2 AZ):

| 구성                                                                                                                                                                        | Interface VPC Endpoint 수   | 월 고정비 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | --------- |
| 기본값 (검증 환경과 Resolver Endpoint 있음, RAG / Agent 없음)                                                                                                               | (14 + 검증 환경용 3) × 2 AZ | 약 $747   |
| 기본값 + 에이전트 빌더                                                                                                                                                      | (16 + 3) × 2 AZ             | 약 $788   |
| 최소 구성: `closedNetworkCreateTestEnvironment: false`, `closedNetworkCreateResolverEndpoint: false`, `closedNetworkVpcEndpointAzs`로 1 AZ, 음성 인식·회의록 생성·번역 숨김 | 11 × 1 AZ                   | 약 $141   |

가장 큰 항목은 검증용 인스턴스와 Resolver Endpoint입니다. 기존 DNS를 통해 자사 네트워크에서 접속하는 경우 둘 다 비활성화하세요. `closedNetworkVpcEndpointAzs`로 AZ를 1개로 지정하면 VPC Endpoint 비용이 절반이 되지만 가용성은 낮아집니다.

## 유효한 구성 파일 예시

다음은 유효한 parameter.ts의 예시입니다. cdk.json을 사용하는 경우 적절히 조정하세요.

```typescript
const envs: Record<string, Partial<StackInput>> = {
  // 환경 이름 'priv'로 배포 (환경 이름은 임의로 지정 가능)
  priv: {
    region: 'ap-northeast-1',
    modelRegion: 'ap-northeast-1',
    modelIds: ['apac.anthropic.claude-sonnet-4-20250514-v1:0'],
    imageGenerationModelIds: ['amazon.nova-canvas-v1:0'],
    videoGenerationModelIds: ['amazon.nova-reel-v1:0'],
    // Voice Chat은 사용할 수 없음
    speechToSpeechModelIds: [],
    // 선택적 설정
    ragEnabled: true,
    ragKnowledgeBaseEnabled: true,
    agentEnabled: true,
    mcpEnabled: true,
    guardrailEnabled: true,
    useCaseBuilderEnabled: true,
    // 폐쇄 네트워크 옵션 (아래부터)
    closedNetworkMode: true,
    // 도메인을 설정하지 않는 경우 다음 두 개는 필요하지 않음
    closedNetworkDomainName: 'genu.closed',
    closedNetworkCertificateArn:
      'arn:aws:acm:ap-northeast-1:111111111111:certificate/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    // 기존 VPC와 서브넷을 지정하는 경우 (새로 생성하는 경우 다음 두 개는 필요하지 않음)
    closedNetworkVpcId: 'vpc-00000000000000000',
    closedNetworkSubnetIds: [
      'subnet-11111111111111111',
      'subnet-22222222222222222',
    ],
  },
};
```

## 배포 방법

`closedNetwork...` 옵션을 구성한 후 [README.md](/README.md)에 작성된 일반 절차를 사용하여 배포하세요. ClosedNetworkStack\<환경 이름>이라는 추가 스택이 배포됩니다. (편의상 이후 \<환경 이름>은 생략합니다.)
GenU에 액세스하는 URL은 ClosedNetworkStack의 WebUrl에 출력됩니다. GenerativeAiUseCasesStack의 WebUrl이 아님에 주의하세요.
또한 GenerativeAiUseCasesStack의 배포가 완료될 때까지 GenU에 액세스할 수 없습니다.

## 검증 방법

closedNetworkCreateTestEnvironment를 true로 설정하고 배포했을 때의 검증 방법을 설명합니다. 관리 콘솔을 통해 Windows EC2 인스턴스에 액세스하세요.

### 1단계. EC2 키 페어 개인 키 획득

Windows 인스턴스에 RDP를 통해 연결하기 위해 EC2에 설정된 키 페어의 개인 키를 획득합니다. 개인 키를 획득하는 명령은 `WindowsRdpGetSSMKeyCommand...`로 시작하는 ClosedNetworkStack 출력에 표시됩니다.
다음과 같습니다:

```bash
aws ssm get-parameter --name /ec2/keypair/key-aaaaaaaaaaaaaaaaa --region ap-northeast-1 --with-decryption --query Parameter.Value --output text
```

이 명령을 실행한 결과를 복사하세요.

### 2단계. Windows 인스턴스에 연결

1. 관리 콘솔을 열고 [EC2](https://console.aws.amazon.com/ec2/home)로 이동합니다.
2. ClosedNetworkStack...으로 시작하는 이름의 인스턴스를 확인하고 우측 상단의 "연결"을 클릭합니다.
3. RDP 클라이언트 탭을 선택하고 Fleet manager를 사용하여 연결을 선택한 후 Fleet Manager Remote Desktop을 클릭합니다.
4. 인증 유형으로 키 페어를 선택하고, 키 페어 콘텐츠로 키 페어 콘텐츠 붙여넣기를 선택한 후 1단계에서 획득한 개인 키를 붙여넣습니다.
5. 연결을 클릭합니다.

### 3단계. GenU 액세스

Windows 내에서 Edge 브라우저를 열고 ClosedNetworkStack의 WebUrl 출력에 표시된 URL을 입력하여 GenU에 액세스합니다.
첫 액세스 시 SignUp이 필요합니다.

### 검증 인스턴스에 대해

검증 인스턴스는 자동으로 중지되지 않으므로 검증 완료 후 EC2에서 해당 인스턴스를 수동으로 중지하세요.
또한 검증 환경 자체가 필요하지 않은 경우 closedNetworkCreateTestEnvironment를 false로 설정하고 재배포하여 삭제할 수 있습니다.

## 폐쇄 네트워크 GenU에 사용자 정의 도메인 설정

### 인증서 획득

설정하려는 도메인의 인증서를 발급하고 [AWS Certificate Manager](https://console.aws.amazon.com/acm/home)로 가져옵니다.
생성된 인증서의 ARN을 closedNetworkCertificateArn에 지정하고 도메인을 closedNetworkDomainName에 지정합니다.

다음 절차는 **검증 목적**으로 자체 서명 인증서를 발급하는 것이지만 프로덕션에서는 사용하지 마세요. **브라우저에서 액세스할 때 경고가 표시됩니다.**
`openssl` 명령을 사용합니다.

```bash
# 키를 생성합니다.
openssl genrsa 2048 > ssl.key

# Common Name에 사용할 도메인을 지정합니다
openssl req -new -key ssl.key > ssl.csr

# 10년간 유효하게 발급
openssl x509 -days 3650 -req -signkey ssl.key < ssl.csr > ssl.crt
```

Certificate body에 ssl.crt의 내용을, Certificate private key에 ssl.key의 내용을 붙여넣고 Import certificate 버튼을 클릭합니다.

## 온프레미스 연결을 위한 DNS 서버 구성

여기서는 두 가지를 가정합니다:

- 온프레미스에서 AWS로의 경로가 이미 구축되어 있습니다. (즉, ClosedNetworkStack에서 생성하거나 가져온 VPC의 IP 주소를 지정하여 그 너머의 리소스에 도달할 수 있습니다.)
- Route53 Resolver 엔드포인트가 생성되어 있습니다. (Resolver 엔드포인트는 closedNetworkCreateResolverEndpoint를 true로 설정하여 배포하면 생성됩니다. 이 매개변수는 기본적으로 true입니다.)

클라이언트에서 이름 해석이 필요한 엔드포인트는 다음과 같습니다. `<>`로 둘러싸인 부분은 실제 값으로 교체해야 합니다.

| 서비스 이름                 | 역할                         | 엔드포인트                                                          | 엔드포인트 확인 방법                                                                     |
| --------------------------- | ---------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Application Load Balancer   | 웹 정적 파일 서버            | 사용자 정의 도메인 또는 internal-\<aaa>.\<region>.elb.amazonaws.com | ClosedNetworkStack의 WebUrl 출력으로 확인                                                |
| API Gateway                 | 메인 API                     | \<xxx>.execute-api.\<region>.amazonaws.com                          | **GenerativeAiUseCasesStack**의 ApiEndpoint 출력으로 확인                                |
| API Gateway                 | Cognito User Pool 프록시     | \<yyy>.execute-api.\<region>.amazonaws.com                          | ClosedNetworkStack의 CognitoPrivateProxyCognitoUserPoolProxyApiEndpoint... 출력으로 확인 |
| API Gateway                 | Cognito Identity Pool 프록시 | \<zzz>.execute-api.\<region>.amazonaws.com                          | ClosedNetworkStack의 CognitoPrivateProxyCognitoIdPoolProxyApiEndpoint... 출력으로 확인   |
| Amazon S3                   | 서명된 URL                   | s3.\<region>.amazonaws.com                                          | 엔드포인트는 고정                                                                        |
| AWS Lambda                  | 스트리밍 출력                | lambda.\<region>.amazonaws.com                                      | 엔드포인트는 고정                                                                        |
| Amazon Transcribe           | 음성-텍스트 변환             | transcribe.\<region>.amazonaws.com                                  | 엔드포인트는 고정                                                                        |
| Amazon Transcribe Streaming | 실시간 음성-텍스트 변환      | transcribestreaming.\<region>.amazonaws.com                         | 엔드포인트는 고정                                                                        |
| Amazon Polly                | 텍스트-음성 변환             | polly.\<region>.amazonaws.com                                       | 엔드포인트는 고정                                                                        |

위 표의 모든 엔드포인트에 대해 Resolver 엔드포인트의 IP 주소를 리졸버(포워더)로 지정하도록 DNS 서버 구성을 수정하세요.
Resolver 엔드포인트의 IP 주소는 [Route53](https://console.aws.amazon.com/route53resolver)을 열고 인바운드 엔드포인트를 선택한 후 생성된 엔드포인트를 클릭하여 확인할 수 있습니다.
"Application Load Balancer에 사용자 정의 도메인을 설정하는 경우"를 제외하고 모든 엔드포인트는 amazonaws.com 도메인입니다. 따라서 가장 단순화된 구성은 amazonaws.com에 대한 리졸버로 Resolver 엔드포인트의 IP 주소를 지정하는 것입니다. 그러나 이 구성은 범위가 넓고 부작용이 크므로 각 엔드포인트의 FQDN을 개별적으로 구성하는 것을 강력히 권장합니다.

검증 목적으로 로컬 머신의 DNS 서버로 Resolver 엔드포인트 IP를 설정할 수도 있습니다. 그러나 이 경우에도 부작용에 대한 우려가 있으므로 운영 검증 후 설정을 되돌리는 것을 강력히 권장합니다.

### 운영 검증을 위해 /etc/hosts를 구성하는 경우

로컬 머신의 /etc/hosts를 구성할 때는 Resolver 엔드포인트가 아닌 각 엔드포인트의 IP 주소가 필요합니다.
그러나 이러한 IP 주소는 변경될 수 있고 중복성 없이 단일 IP 주소만 지정할 수 있으므로 운영 검증 목적으로만 사용하세요.
다음은 구성이 필요한 엔드포인트와 IP 주소 확인 방법을 정리한 것입니다.

| 서비스 이름                 | 역할                         | 엔드포인트                                                          | IP 주소 확인 방법 |
| --------------------------- | ---------------------------- | ------------------------------------------------------------------- | ----------------- |
| Application Load Balancer   | 웹 정적 파일 서버            | 사용자 정의 도메인 또는 internal-\<aaa>.\<region>.elb.amazonaws.com | 방법 1            |
| API Gateway                 | 메인 API                     | \<xxx>.execute-api.\<region>.amazonaws.com                          | 방법 2            |
| API Gateway                 | Cognito User Pool 프록시     | \<yyy>.execute-api.\<region>.amazonaws.com                          | 방법 2            |
| API Gateway                 | Cognito Identity Pool 프록시 | \<zzz>.execute-api.\<region>.amazonaws.com                          | 방법 2            |
| Amazon S3                   | 서명된 URL                   | \<S3 버킷 이름>.s3.\<region>.amazonaws.com                          | 방법 2            |
| AWS Lambda                  | 스트리밍 출력                | lambda.\<region>.amazonaws.com                                      | 방법 2            |
| Amazon Transcribe           | 음성-텍스트 변환             | transcribe.\<region>.amazonaws.com                                  | 방법 2            |
| Amazon Transcribe Streaming | 실시간 음성-텍스트 변환      | transcribestreaming.\<region>.amazonaws.com                         | 방법 2            |
| Amazon Polly                | 텍스트-음성 변환             | polly.\<region>.amazonaws.com                                       | 방법 2            |

- 방법 1: [EC2](https://console.aws.amazon.com/ec2/home)에서 네트워크 인터페이스를 열고 "elb"를 검색합니다. 대상 ENI는 ClosedNetworkStack...으로 시작하는 보안 그룹 이름을 가진 것입니다. 네트워크 인터페이스 ID를 클릭하여 Private IPv4 주소를 확인합니다. 여러 개가 있으므로 그 중 하나를 선택합니다.
- 방법 2: [VPC](https://console.aws.amazon.com/vpcconsole/home)에서 엔드포인트를 열고 해당 서비스 이름을 찾습니다. 서비스 이름은 엔드포인트의 역순입니다. (단, API Gateway의 경우 ID는 생략됩니다.) VPC 엔드포인트 ID를 클릭하여 페이지 하단에서 배포된 서브넷과 IP 주소를 확인합니다. 여러 개가 있으므로 그 중 하나를 선택합니다.
