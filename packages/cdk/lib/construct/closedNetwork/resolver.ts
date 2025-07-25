import {
  IVpc,
  Peer,
  Port,
  SecurityGroup,
  ISubnet,
  SubnetType,
  SubnetFilter,
} from 'aws-cdk-lib/aws-ec2';
import { CfnResolverEndpoint } from 'aws-cdk-lib/aws-route53resolver';
import { Construct } from 'constructs';

export interface ResolverProps {
  vpc: IVpc;
  subnetIds?: string[] | null;
}

export class Resolver extends Construct {
  public readonly resolverEndpoint: CfnResolverEndpoint;

  constructor(scope: Construct, id: string, props: ResolverProps) {
    super(scope, id);

    const resolverSecurityGroup = new SecurityGroup(
      this,
      'ResolverSecurityGroup',
      {
        vpc: props.vpc,
        allowAllOutbound: true,
      }
    );

    resolverSecurityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(53),
      'DNS TCP'
    );
    resolverSecurityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.udp(53),
      'DNS UDP'
    );

    const subnets = props.vpc.selectSubnets(
      props.subnetIds
        ? {
            subnetFilters: [SubnetFilter.byIds(props.subnetIds)],
          }
        : {
            subnetType: SubnetType.PRIVATE_ISOLATED,
          }
    ).subnets;

    const ipAddresses: CfnResolverEndpoint.IpAddressRequestProperty[] =
      subnets.map((s: ISubnet) => ({ subnetId: s.subnetId }));

    // https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-route53resolver-resolverendpoint.html#cfn-route53resolver-resolverendpoint-ipaddresses
    if (ipAddresses.length < 2) {
      throw new Error('Need at least 2 isolated subnets in different AZs.');
    }

    const resolverEndpoint = new CfnResolverEndpoint(this, 'InbountEndpoint', {
      direction: 'INBOUND',
      ipAddresses,
      securityGroupIds: [resolverSecurityGroup.securityGroupId],
    });

    this.resolverEndpoint = resolverEndpoint;
  }
}
