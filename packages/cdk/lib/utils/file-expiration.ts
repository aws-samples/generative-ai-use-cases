import { Duration } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { USER_FILE_PREFIX } from '@generative-ai-use-cases/common';

/**
 * Delete what users added or generated after `days` days (#1213).
 *
 * In the file bucket only the per-user prefix expires: objects stored outside
 * it (by versions before the per-user layout) are left to the migration script
 * and to the operator. Buckets that hold only such files expire as a whole.
 */
export const expireUserFiles = (
  days: number | null | undefined,
  fileBucket: Bucket,
  wholeBuckets: (Bucket | undefined)[] = []
): void => {
  if (!days) return;
  const expiration = Duration.days(days);
  fileBucket.addLifecycleRule({
    id: 'ExpireUserFiles',
    prefix: USER_FILE_PREFIX,
    expiration,
  });
  for (const bucket of wholeBuckets) {
    bucket?.addLifecycleRule({ id: 'ExpireFiles', expiration });
  }
};
