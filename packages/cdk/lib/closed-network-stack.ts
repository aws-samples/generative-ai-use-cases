import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { ProcessedStackInput } from './stack-input';
import { ClosedVpc, ClosedWeb, WindowsRdp, Resolver } from './construct';
import { REMOTE_OUTPUT_KEYS } from './remote-output-keys';

export interface ClosedNetworkStackProps extends StackProps {
  readonly params: ProcessedStackInput;
  readonly isSageMakerStudio: boolean;
}

export class ClosedNetworkStack extends Stack {
  public readonly vpc: ec2.IVpc;
  public readonly closedVpc: ClosedVpc;
  public readonly apiGatewayVpcEndpoint: ec2.InterfaceVpcEndpoint;
  public readonly webBucket: s3.Bucket;

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
      isSageMakerStudio: props.isSageMakerStudio,
    });

    const albOrigin = `http://${closedWeb.alb.loadBalancerDnsName}`;
    const webUrl =
      closedVpc.hostedZone && closedNetworkCertificateArn
        ? `https://${closedVpc.hostedZone.zoneName}`
        : albOrigin;

    // Emitted unconditionally and consumed via cdk-remote-stack RemoteOutputs
    // (not Fn::ImportValue). A plain CfnOutput has no cross-stack export
    // constraint, so toggling closedNetworkDomainName never triggers the
    // "Cannot delete export ... as it is in use" deadlock with the consuming
    // GenerativeAiUseCasesStack — an ALB-DNS test env can move to a custom
    // domain with a single deploy.
    new CfnOutput(this, REMOTE_OUTPUT_KEYS.CLOSED_NETWORK_ALB_ORIGIN, {
      value: albOrigin,
    });

    new CfnOutput(this, REMOTE_OUTPUT_KEYS.CLOSED_NETWORK_WEB_URL, {
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
    this.closedVpc = closedVpc;
    this.webBucket = closedWeb.bucket;
    this.apiGatewayVpcEndpoint = closedVpc.apiGatewayVpcEndpoint;
  }
}
