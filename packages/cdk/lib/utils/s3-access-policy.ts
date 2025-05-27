import { Effect, IRole, PolicyStatement } from 'aws-cdk-lib/aws-iam';

const createSourceIpCondition = (
  allowedIpV4AddressRanges?: string[] | null,
  allowedIpV6AddressRanges?: string[] | null
) =>
  // Create a source IP condition when either IPv4 or IPv6 address ranges are specified (not null/undefined)
  // An empty array (e.g., []) means no access is allowed for that IP version
  // If both parameters are null/undefined, this function returns undefined
  allowedIpV4AddressRanges || allowedIpV6AddressRanges
    ? {
        IpAddress: {
          'aws:SourceIp': [
            ...(allowedIpV4AddressRanges == null // null or undefined
              ? ['0.0.0.0/0']
              : allowedIpV4AddressRanges),
            ...(allowedIpV6AddressRanges == null // null or undefined
              ? ['::/0']
              : allowedIpV6AddressRanges),
          ],
        },
      }
    : undefined;

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
