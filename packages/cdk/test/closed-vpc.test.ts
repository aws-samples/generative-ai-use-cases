import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ClosedVpc } from '../lib/construct/closedNetwork/closed-vpc';

// With a concrete env, the AZ names resolve to dummy values (dummy1a, dummy1b)
const createTemplate = (vpcEndpointAvailabilityZones?: string[] | null) => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'TestStack', {
    env: { account: '123456789012', region: 'ap-northeast-1' },
  });
  new ClosedVpc(stack, 'ClosedVpc', {
    ipv4Cidr: '10.0.0.0/16',
    vpcEndpointAvailabilityZones,
  });
  return Template.fromStack(stack);
};

const getInterfaceEndpointSubnetCounts = (template: Template): number[] =>
  Object.values(
    template.findResources('AWS::EC2::VPCEndpoint', {
      Properties: { VpcEndpointType: 'Interface' },
    })
  ).map((resource) => resource.Properties.SubnetIds.length);

describe('ClosedVpc', () => {
  test.each([
    ['not specified', undefined],
    ['null', null],
    ['empty array', []],
  ])('creates Interface VPC Endpoints in all AZs when AZs are %s', (_, azs) => {
    const counts = getInterfaceEndpointSubnetCounts(createTemplate(azs));
    expect(counts.length).toBeGreaterThan(0);
    expect(counts.every((c) => c === 2)).toBe(true);
  });

  test('creates Interface VPC Endpoints in only one AZ when one AZ is specified', () => {
    const template = createTemplate(['dummy1a']);
    const counts = getInterfaceEndpointSubnetCounts(template);
    expect(counts.length).toBeGreaterThan(0);
    expect(counts.every((c) => c === 1)).toBe(true);
    // VPC itself still spans 2 AZs (ALB / Resolver need them)
    template.resourcePropertiesCountIs(
      'AWS::EC2::Subnet',
      { AvailabilityZone: Match.anyValue() },
      2
    );
  });

  test('creates Interface VPC Endpoints in both AZs when both AZs are specified', () => {
    const counts = getInterfaceEndpointSubnetCounts(
      createTemplate(['dummy1a', 'dummy1b'])
    );
    expect(counts.every((c) => c === 2)).toBe(true);
  });

  test('creates only the listed Interface VPC Endpoints', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'ap-northeast-1' },
    });
    new ClosedVpc(stack, 'ClosedVpc', {
      ipv4Cidr: '10.0.0.0/16',
      vpcEndpointNames: ['ApiGateway', 'Bedrock'],
    });
    expect(
      getInterfaceEndpointSubnetCounts(Template.fromStack(stack))
    ).toHaveLength(2);
  });

  test('throws on an unknown Interface VPC Endpoint name', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'ap-northeast-1' },
    });
    expect(
      () =>
        new ClosedVpc(stack, 'ClosedVpc', {
          ipv4Cidr: '10.0.0.0/16',
          vpcEndpointNames: ['ApiGateway', 'Typo'],
        })
    ).toThrow(/Typo/);
  });

  test('throws when the specified AZ does not exist', () => {
    expect(() => createTemplate(['dummy1z'])).toThrow();
  });
});
