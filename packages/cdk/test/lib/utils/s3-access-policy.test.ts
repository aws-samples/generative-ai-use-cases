import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { allowS3AccessWithSourceIpCondition } from '../../../lib/utils/s3-access-policy';

const statementFor = (ipConditions?: {
  ipv4?: string[] | null;
  ipv6?: string[] | null;
}) => {
  const stack = new Stack(new App(), 'Test');
  const role = new Role(stack, 'Role', {
    assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
  });
  allowS3AccessWithSourceIpCondition('bucket', role, 'read', ipConditions);
  const policies = Template.fromStack(stack).findResources('AWS::IAM::Policy');
  return Object.values(policies)[0].Properties.PolicyDocument.Statement[0];
};

describe('allowS3AccessWithSourceIpCondition', () => {
  it('adds no condition when no ranges are given', () => {
    expect(statementFor().Condition).toBeUndefined();
  });

  it('adds no condition when the range lists are empty', () => {
    expect(statementFor({ ipv4: [], ipv6: [] }).Condition).toBeUndefined();
  });

  it('limits the grant to the given ranges', () => {
    expect(
      statementFor({ ipv4: ['192.0.2.0/24'], ipv6: ['2001:db8::/32'] })
        .Condition
    ).toEqual({
      IpAddress: { 'aws:SourceIp': ['192.0.2.0/24', '2001:db8::/32'] },
    });
  });
});
