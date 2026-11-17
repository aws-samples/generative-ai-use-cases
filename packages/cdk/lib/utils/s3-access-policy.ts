import { Effect, IRole, PolicyStatement } from 'aws-cdk-lib/aws-iam';

const createSourceIpCondition = (
  allowedIpV4AddressRanges?: string[] | null,
  allowedIpV6AddressRanges?: string[] | null
) => {
  const ranges = [
    ...(allowedIpV4AddressRanges ?? []),
    ...(allowedIpV6AddressRanges ?? []),
  ];
  // No ranges means no IP restriction. An empty `aws:SourceIp` list would
  // match no request and silently disable the grant.
  return ranges.length > 0
    ? { IpAddress: { 'aws:SourceIp': ranges } }
    : undefined;
};

export const allowS3AccessWithSourceIpCondition = (
  bucketName: string,
  role: IRole,
  accessType: 'read' | 'write',
  ipConditions?: {
    ipv4?: string[] | null;
    ipv6?: string[] | null;
  }
) => {
  role.addToPrincipalPolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      resources: [`arn:aws:s3:::${bucketName}`, `arn:aws:s3:::${bucketName}/*`],
      actions:
        accessType === 'read'
          ? ['s3:GetBucket*', 's3:GetObject*', 's3:List*']
          : ['s3:Abort*', 's3:DeleteObject*', 's3:PutObject*'],
      conditions: createSourceIpCondition(
        ipConditions?.ipv4,
        ipConditions?.ipv6
      ),
    })
  );
};
