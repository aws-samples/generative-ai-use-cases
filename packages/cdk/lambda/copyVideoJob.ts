import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { VideoJob } from 'generative-ai-use-cases';
import { updateJobStatus } from './repositoryVideoJob';

export interface CopyVideoJobParams {
  job: VideoJob;
}

const BUCKET_NAME: string = process.env.BUCKET_NAME!;
const videoBucketRegionMap = JSON.parse(
  process.env.VIDEO_BUCKET_REGION_MAP ?? '{}'
);

const copyAndDeleteObject = async (
  jobId: string,
  srcBucket: string,
  srcRegion: string,
  dstBucket: string,
  dstRegion: string
) => {
  const srcS3 = new S3Client({ region: srcRegion });
  const dstS3 = new S3Client({ region: dstRegion });

  const { Body, ContentType, ContentLength } = await srcS3.send(
    new GetObjectCommand({
      Bucket: srcBucket,
      Key: `${jobId}/output.mp4`,
    })
  );

  const chunks = [];
  for await (const chunk of Body as Readable) {
    chunks.push(chunk);
  }
  const fileBuffer = Buffer.concat(chunks);

  await dstS3.send(
    new PutObjectCommand({
      Bucket: dstBucket,
      Key: `${jobId}/output.mp4`,
      Body: fileBuffer,
      ContentType,
      ContentLength,
    })
  );

  const listRes = await srcS3.send(
    new ListObjectsV2Command({
      Bucket: srcBucket,
      Prefix: jobId,
    })
  );

  const objects = listRes.Contents?.map((object) => ({
    Key: object.Key,
  }));

  await srcS3.send(
    new DeleteObjectsCommand({
      Bucket: srcBucket,
      Delete: {
        Objects: objects,
      },
    })
  );
};

export const handler = async (event: CopyVideoJobParams): Promise<void> => {
  const job = event.job;
  const jobId = job.jobId;
  const dstRegion = process.env.AWS_DEFAULT_REGION!;
  const dstBucket = BUCKET_NAME;
  const srcRegion = job.region;
  const srcBucket = videoBucketRegionMap[srcRegion];

  try {
    await copyAndDeleteObject(
      jobId,
      srcBucket,
      srcRegion,
      dstBucket,
      dstRegion
    );

    await updateJobStatus(job, 'Completed');
  } catch (error) {
    console.error(error);
    await updateJobStatus(job, 'Failed');
  }
};
