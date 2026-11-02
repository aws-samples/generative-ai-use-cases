# 폐쇄 네트워크 모드

`closedNetworkMode` 옵션을 true로 설정하면 클라이언트에서 GenU로의 통신을 폐쇄 네트워크를 통해 활성화할 수 있습니다.
또한 GenU의 주요 컴퓨팅 리소스인 AWS Lambda와 다른 AWS 서비스(Amazon DynamoDB, Amazon S3, Amazon Bedrock 등) 간의 통신이 VPC 내에서 완료됩니다. 아키텍처 변경사항은 다음과 같습니다:

- Amazon CloudFront는 사용되지 않으며, 웹 정적 파일은 Application Load Balancer와 ECS Fargate에서 제공됩니다.
- Amazon Cognito는 Amazon API Gateway를 통해 액세스됩니다.
- Lambda 함수에서 다른 서비스로의 통신은 VPC 엔드포인트를 통해 수행됩니다.

폐쇄 네트워크 모드와 관련된 옵션은 `closedNetwork` 접두사를 가집니다. 다음은 옵션 목록입니다:

| 매개변수                              | 설명                                                                                                                                                                                                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| closedNetworkMode                     | 폐쇄 네트워크 모드를 활성화할지 여부. true는 폐쇄 네트워크 모드를 활성화합니다. 기본값은 false입니다.                                                                                                                                                      |
| closedNetworkVpcIpv4Cidr              | 새 VPC를 생성할 때 지정할 IPv4 CIDR. 기본값은 10.0.0.0/16입니다.                                                                                                                                                                                           |
| closedNetworkVpcId                    | 기존 VPC를 가져올 때의 VPC ID. 지정하지 않으면 새 VPC가 생성됩니다.                                                                                                                                                                                        |
| closedNetworkSubnetIds                | GenU 관련 리소스가 배포될 여러 서브넷 ID를 지정합니다. ALB, Fargate 작업, VPC 엔드포인트, Resolver 엔드포인트가 생성됩니다. 지정하지 않으면 격리된 서브넷이 선택됩니다. 배열에 2개 이상의 서브넷 ID를 지정하세요.                                          |
| closedNetworkApiGatewayVpcEndpointIds | API Gateway 리소스 정책에서 추가로 허용할 VPC 엔드포인트 ID 배열입니다. GenU가 생성하는 API Gateway VPC 엔드포인트는 항상 허용됩니다. 다른 VPC나 다른 계정의 VPC 엔드포인트(예: 집약 VPC의 공유 엔드포인트)를 통해 API Gateway를 호출하는 경우 지정합니다. |
| closedNetworkCertificateArn           | GenU에 도메인을 할당할 때 지정할 ACM ARN. ACM은 수동으로 생성해야 합니다. 지정하지 않으면 GenU는 Application Load Balancer의 기본 엔드포인트로 게시됩니다.                                                                                                 |
| closedNetworkDomainName               | GenU의 도메인 이름. Private Hosted Zone은 CDK에서 생성되므로 수동 생성이 필요하지 않습니다. `closedNetworkCertificateArn`과 `closedNetworkDomainName`은 함께 지정하거나 둘 다 생략해야 합니다.                                                             |
| closedNetworkCreateTestEnvironment    | 테스트 환경을 생성할지 여부. 기본적으로 생성됩니다. 필요하지 않으면 false를 지정하세요. 테스트 환경은 EC2 Windows 인스턴스로 생성되며 Fleet Manager를 통해 액세스됩니다. (자세한 절차는 나중에 설명됩니다.)                                                |
| closedNetworkCreateResolverEndpoint   | Route53 Resolver 엔드포인트를 생성할지 여부. 기본값은 true입니다.                                                                                                                                                                                          |

## 현재 제한사항

- 배포는 인터넷 연결이 있는 환경에서 수행해야 합니다. 또한 관리 콘솔에서 운영 검증 환경에 액세스할 때도 인터넷 연결이 필요합니다.
- 배포에는 일반 모드 배포와 동일한 환경이 필요합니다. 구체적으로 AWS IAM 사용자 구성, Node.js, Docker가 필요합니다.
- GenU가 배포되는 지역과 모델 지역이 동일해야 합니다. 현재 GenU를 ap-northeast-1에 배포하고 us-east-1의 모델을 사용하는 것은 불가능합니다.
- 다양한 리소스가 생성되므로 기존 VPC를 가져올 때는 가능한 한 깨끗한 환경을 사용하는 것이 좋습니다.
- SAML 통합은 사용할 수 없습니다.
- Voice Chat 사용 사례는 현재 사용할 수 없습니다.
- AgentCore Chat 사용 사례는 현재 사용할 수 없습니다.

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
