import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as agw from 'aws-cdk-lib/aws-apigateway';
import { ProcessedStackInput } from './stack-input';
import {
  ClosedVpc,
  ClosedWeb,
  CognitoPrivateProxy,
  WindowsRdp,
  Resolver,
} from './construct';

export interface ClosedNetworkStackProps extends StackProps {
  readonly params: ProcessedStackInput;
}

export class ClosedNetworkStack extends Stack {
  public readonly vpc: ec2.IVpc;
  public readonly apiGatewayVpcEndpoint: ec2.InterfaceVpcEndpoint;
  public readonly webBucket: s3.Bucket;
  public readonly cognitoUserPoolProxyApi: agw.RestApi;
  public readonly cognitoIdPoolProxyApi: agw.RestApi;

  constructor(scope: Construct, id: string, props: ClosedNetworkStackProps) {
    super(scope, id, props);

    const {
      closedNetworkVpcId,
      closedNetworkVpcIpv4Cidr,
      closedNetworkSubnetIds,
      closedNetworkCertificateArn,
      closedNetworkDomainName,
      closedNetworkCreateTestEnvironment,
      closedNetworkCreateResolverEndpoint,
      modelRegion,
      modelIds,
      crossAccountBedrockRoleArn,
    } = props.params;

    if (this.region !== modelRegion) {
      throw new Error(
        `The app region and modelRegion must be same if closedNetworkMode=true (${this.region} vs ${modelRegion})`
      );
    }

    const modelRegions = [
      ...new Set(
        modelIds.map(
          (model: { modelId: string; region: string }) => model.region
        )
      ),
    ];

    if (modelRegions.length !== 1 || modelRegions[0] !== this.region) {
      throw new Error(
        'You cannot specify the regions other than the app region if closedNetworkMode=true'
      );
    }

    if (crossAccountBedrockRoleArn && crossAccountBedrockRoleArn.length > 0) {
      throw new Error(
        'You cannot specify crossAccountBedrockRoleArn if closedNetworkMode=true'
      );
    }

    const closedVpc = new ClosedVpc(this, 'ClosedVpc', {
      vpcId: closedNetworkVpcId,
      subnetIds: closedNetworkSubnetIds,
      ipv4Cidr: closedNetworkVpcIpv4Cidr,
      domainName: closedNetworkDomainName,
    });

    const closedWeb = new ClosedWeb(this, 'ClosedWeb', {
      vpc: closedVpc.vpc,
      subnetIds: closedNetworkSubnetIds,
      hostedZone: closedVpc?.hostedZone,
      certificateArn: closedNetworkCertificateArn,
    });

    const cognitoPrivateProxy = new CognitoPrivateProxy(
      this,
      'CognitoPrivateProxy',
      {
        vpcEndpoint: closedVpc.apiGatewayVpcEndpoint,
      }
    );

    const webUrl =
      closedVpc.hostedZone && closedNetworkCertificateArn
        ? `https://${closedVpc.hostedZone.zoneName}`
        : `http://${closedWeb.alb.loadBalancerDnsName}`;

    new CfnOutput(this, 'WebUrl', {
      value: webUrl,
    });

    if (closedNetworkCreateResolverEndpoint) {
      const resolver = new Resolver(this, 'Resolver', {
        vpc: closedVpc.vpc,
        subnetIds: closedNetworkSubnetIds,
      });

      new CfnOutput(this, 'ResolverId', {
        value: resolver.resolverEndpoint.ref,
      });
    }

    if (closedNetworkCreateTestEnvironment) {
      new WindowsRdp(this, 'WindowsRdp', {
        vpc: closedVpc.vpc,
        subnetIds: closedNetworkSubnetIds,
      });
    }

    this.vpc = closedVpc.vpc;
    this.webBucket = closedWeb.bucket;
    this.apiGatewayVpcEndpoint = closedVpc.apiGatewayVpcEndpoint;
    this.cognitoUserPoolProxyApi = cognitoPrivateProxy.cognitoUserPoolProxyApi;
    this.cognitoIdPoolProxyApi = cognitoPrivateProxy.cognitoIdPoolProxyApi;
  }
}
