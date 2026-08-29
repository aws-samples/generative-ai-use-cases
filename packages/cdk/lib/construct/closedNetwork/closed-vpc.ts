import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { PrivateHostedZone } from 'aws-cdk-lib/aws-route53';

const VPC_ENDPOINTS: Record<string, ec2.InterfaceVpcEndpointAwsService> = {
  // VPC Endpoints required by user side
  ApiGateway: ec2.InterfaceVpcEndpointAwsService.APIGATEWAY,
  Lambda: ec2.InterfaceVpcEndpointAwsService.LAMBDA,
  Transcribe: ec2.InterfaceVpcEndpointAwsService.TRANSCRIBE,
  TranscribeStreaming: ec2.InterfaceVpcEndpointAwsService.TRANSCRIBE_STREAMING,
  Polly: ec2.InterfaceVpcEndpointAwsService.POLLY,
  AgentCore: ec2.InterfaceVpcEndpointAwsService.BEDROCK_AGENTCORE,
  AgentCoreGateway:
    ec2.InterfaceVpcEndpointAwsService.BEDROCK_AGENTCORE_GATEWAY,
  // Cognito VPC Endpoints (Private Link)
  CognitoIdp: ec2.InterfaceVpcEndpointAwsService.COGNITO_IDP,
  CognitoIdentity: new ec2.InterfaceVpcEndpointAwsService('cognito-identity'),
  // S3 Interface Endpoint (for presigned URL access from frontend)
  S3: ec2.InterfaceVpcEndpointAwsService.S3,
  // VPC Endpoints required by app side
  Bedrock: ec2.InterfaceVpcEndpointAwsService.BEDROCK_RUNTIME,
  BedrockAgent: ec2.InterfaceVpcEndpointAwsService.BEDROCK_AGENT_RUNTIME,
  BedrockAgentApi: ec2.InterfaceVpcEndpointAwsService.BEDROCK_AGENT,
  Ecr: ec2.InterfaceVpcEndpointAwsService.ECR,
  EcrDocker: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
  CloudWatchLogs: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
  Kendra: ec2.InterfaceVpcEndpointAwsService.KENDRA,
  Sts: ec2.InterfaceVpcEndpointAwsService.STS,
  // Required by AgentCore Gateway to read API key secrets at invocation time,
  // and by the API Key Credential Provider creation flow to read user secrets.
  SecretsManager: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
};

export interface ClosedVpcProps {
  readonly vpcId?: string | null;
  readonly subnetIds?: string[] | null;
  readonly ipv4Cidr: string;
  readonly domainName?: string | null;
}

export class ClosedVpc extends Construct {
  public readonly vpc: ec2.IVpc;
  public readonly subnets: ec2.ISubnet[];
  public readonly apiGatewayVpcEndpoint: ec2.InterfaceVpcEndpoint;
  public readonly hostedZone: PrivateHostedZone | undefined;

  constructor(scope: Construct, id: string, props: ClosedVpcProps) {
    super(scope, id);

    let vpc: ec2.IVpc;

    if (props.vpcId) {
      vpc = ec2.Vpc.fromLookup(this, 'ImportedVpc', {
        vpcId: props.vpcId,
      });
    } else {
      vpc = new ec2.Vpc(this, 'ClosedVpc', {
        ipAddresses: ec2.IpAddresses.cidr(props.ipv4Cidr),
        maxAzs: 2,
        subnetConfiguration: [
          {
            name: 'isolated',
            subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          },
        ],
      });
    }

    // Resolve the subnet set used by VPC endpoints; reused by other constructs (e.g. AgentCore Runtime)
    this.subnets = props.subnetIds
      ? props.subnetIds.map((subnetId, index) =>
          ec2.Subnet.fromSubnetId(this, `ClosedSubnet${index}`, subnetId)
        )
      : vpc.isolatedSubnets;

    vpc.addGatewayEndpoint('S3GatewayEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    vpc.addGatewayEndpoint('DynamoDbGatewayEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });

    const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
    });

    securityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(443)
    );

    const securityGroupWebSocket = new ec2.SecurityGroup(
      this,
      'SecurityGroupWebSocket',
      {
        vpc,
      }
    );

    securityGroupWebSocket.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(443)
    );

    securityGroupWebSocket.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(8443)
    );

    for (const [name, service] of Object.entries(VPC_ENDPOINTS)) {
      const vpcEndpoint = new ec2.InterfaceVpcEndpoint(
        this,
        `VpcEndpoint${name}`,
        {
          vpc,
          service,
          subnets: props.subnetIds
            ? {
                subnetFilters: [ec2.SubnetFilter.byIds(props.subnetIds)],
              }
            : {
                subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
              },
          securityGroups: [
            name !== 'TranscribeStreaming'
              ? securityGroup
              : securityGroupWebSocket,
          ],
          privateDnsEnabled: true,
        }
      );

      if (name === 'ApiGateway') {
        this.apiGatewayVpcEndpoint = vpcEndpoint;
      }
    }

    if (props.domainName) {
      this.hostedZone = new PrivateHostedZone(this, 'HostedZone', {
        vpc,
        zoneName: props.domainName,
      });
    }

    this.vpc = vpc;
  }
}
