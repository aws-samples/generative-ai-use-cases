import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

const VPC_ENDPOINTS: Record<string, ec2.InterfaceVpcEndpointAwsService> = {
  Ssm: ec2.InterfaceVpcEndpointAwsService.SSM,
  SsmMessages: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
  Ec2Messages: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
};

export interface WindowsRdpProps {
  readonly vpc: ec2.IVpc;
  readonly subnetIds?: string[] | null;
}

export class WindowsRdp extends Construct {
  constructor(scope: Construct, id: string, props: WindowsRdpProps) {
    super(scope, id);

    const region = cdk.Stack.of(this).region;
    const keyPair = new ec2.KeyPair(this, 'WindowsKeyPair');

    new cdk.CfnOutput(this, 'GetSSMKeyCommand', {
      value: `aws ssm get-parameter --name /ec2/keypair/${keyPair.keyPairId} --region ${
        region
      } --with-decryption --query Parameter.Value --output text`,
    });

    const windowsSecurityGroup = new ec2.SecurityGroup(this, 'WindowsSg', {
      vpc: props.vpc,
    });

    const vpcEndpointSecurityGroup = new ec2.SecurityGroup(
      this,
      'WindowsVpcEndpointSg',
      {
        vpc: props.vpc,
      }
    );

    vpcEndpointSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(443)
    );

    for (const [name, service] of Object.entries(VPC_ENDPOINTS)) {
      const vpcEndpoint = new ec2.InterfaceVpcEndpoint(
        this,
        `VpcEndpoint${name}`,
        {
          vpc: props.vpc,
          service,
          subnets: props.subnetIds
            ? {
                subnetFilters: [ec2.SubnetFilter.byIds(props.subnetIds)],
              }
            : {
                subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
              },
          securityGroups: [vpcEndpointSecurityGroup],
          privateDnsEnabled: true,
        }
      );

      windowsSecurityGroup.connections.allowFrom(
        vpcEndpoint,
        ec2.Port.tcp(443)
      );
    }

    const role = new iam.Role(this, 'WindowsRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
    );

    new ec2.Instance(this, 'windowsInstance', {
      vpc: props.vpc,
      vpcSubnets: props.subnetIds
        ? {
            subnetFilters: [ec2.SubnetFilter.byIds(props.subnetIds)],
          }
        : {
            subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          },
      securityGroup: windowsSecurityGroup,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.MEMORY6_INTEL,
        ec2.InstanceSize.LARGE
      ),
      machineImage: ec2.MachineImage.latestWindows(
        ec2.WindowsVersion.WINDOWS_SERVER_2025_ENGLISH_FULL_BASE
      ),
      keyPair,
      instanceProfile: new iam.InstanceProfile(this, 'InstanceProfile', {
        role,
      }),
      blockDevices: [
        {
          deviceName: '/dev/sda1',
          volume: ec2.BlockDeviceVolume.ebs(100, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });
  }
}
