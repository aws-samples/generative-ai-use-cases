import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  VideoJob,
  ListVideoJobsResponse,
  GenerateVideoRequest,
  CopyVideoJobParams,
} from 'generative-ai-use-cases';
import {
  GetAsyncInvokeCommand,
  ValidationException,
} from '@aws-sdk/client-bedrock-runtime';
import {
  LambdaClient,
  InvokeCommand,
  InvocationType,
} from '@aws-sdk/client-lambda';
import { initBedrockRuntimeClient } from './utils/bedrockClient';
import { videoOutputKey } from '@generative-ai-use-cases/common';

const BUCKET_NAME: string = process.env.BUCKET_NAME!;
const TABLE_NAME: string = process.env.TABLE_NAME!;
const COPY_VIDEO_JOB_FUNCTION_ARN = process.env.COPY_VIDEO_JOB_FUNCTION_ARN!;
const dynamoDb = new DynamoDBClient({});
const dynamoDbDocument = DynamoDBDocumentClient.from(dynamoDb);
const lambda = new LambdaClient({});

/** Where a finished video is kept: under the owner's file prefix (their sub). */
export const videoOutputUri = (ownerSub: string, jobId: string): string =>
  `s3://${BUCKET_NAME}/${videoOutputKey(ownerSub, jobId)}`;

// The generation parameters kept on a job item, shown in the video job list.
const VIDEO_JOB_PARAM_KEYS = [
  'taskType',
  'prompt',
  'durationSeconds',
  'dimension',
  'fps',
  'seed',
  'resolution',
  'aspectRatio',
  'loop',
] as const;

/** The known scalar generation parameters of a request; anything else is dropped. */
export const videoJobParams = (
  params: unknown
): Partial<Record<(typeof VIDEO_JOB_PARAM_KEYS)[number], unknown>> => {
  if (!params || typeof params !== 'object') return {};
  const source = params as Record<string, unknown>;
  const kept: Partial<Record<(typeof VIDEO_JOB_PARAM_KEYS)[number], unknown>> =
    {};
  for (const key of VIDEO_JOB_PARAM_KEYS) {
    const value = source[key];
    if (['string', 'number', 'boolean'].includes(typeof value)) {
      kept[key] = value;
    }
  }
  return kept;
};

export const createJob = async (
  _userId: string,
  ownerSub: string,
  invocationArn: string,
  req: GenerateVideoRequest
) => {
  const userId = `videoJob#${_userId}`;
  const jobId = invocationArn.split('/').slice(-1)[0];

  // The job's own fields come last so that nothing in the request can replace
  // them; the first frame image of Nova Reel is not kept.
  const item = {
    ...videoJobParams(req.params),
    id: userId,
    createdDate: `${Date.now()}`,
    jobId,
    invocationArn,
    status: 'InProgress',
    output: videoOutputUri(ownerSub, jobId),
    modelId: req.model!.modelId,
    region: req.model!.region,
  };

  await dynamoDbDocument.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  return item;
};

export const updateJobStatus = async (job: VideoJob, status: string) => {
  const updateCommand = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      id: job.id,
      createdDate: job.createdDate,
    },
    UpdateExpression: 'set #status = :status',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': status,
    },
  });

  await dynamoDbDocument.send(updateCommand);
};

const checkAndUpdateJob = async (
  job: VideoJob
): Promise<'InProgress' | 'Completed' | 'Failed' | 'Finalizing'> => {
  try {
    const client = await initBedrockRuntimeClient({ region: job.region });
    const command = new GetAsyncInvokeCommand({
      invocationArn: job.invocationArn,
    });

    let res;

    try {
      res = await client.send(command);
    } catch (e) {
      // If it takes time to get the result, GetAsyncInvokeCommand may result in a ValidationException.
      // In such cases, proceed assuming it has reached the Completed state.
      if (e instanceof ValidationException) {
        console.error(e);
        res = { status: 'Completed' as const };
      } else {
        throw e;
      }
    }

    // Video generation is complete, but the video copying is not finished.
    // We will run the copy job to set the status to "Finalizing".
    if (res.status === 'Completed') {
      const params: CopyVideoJobParams = { job };

      await lambda.send(
        new InvokeCommand({
          FunctionName: COPY_VIDEO_JOB_FUNCTION_ARN,
          InvocationType: InvocationType.Event,
          Payload: JSON.stringify(params),
        })
      );

      await updateJobStatus(job, 'Finalizing');
      return 'Finalizing';
    } else if (res.status === 'Failed') {
      // Since video generation has failed, we will not copy the video and will terminate with a Failed status.
      await updateJobStatus(job, 'Failed');
      return 'Failed';
    } else {
      // This res.status will be InProgress only.
      return res.status!;
    }
  } catch (e) {
    console.error(e);
    return job.status;
  }
};

export const listVideoJobs = async (
  _userId: string,
  _exclusiveStartKey?: string
): Promise<ListVideoJobsResponse> => {
  const exclusiveStartKey = _exclusiveStartKey
    ? JSON.parse(Buffer.from(_exclusiveStartKey, 'base64').toString())
    : undefined;

  const userId = `videoJob#${_userId}`;
  const res = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: '#id = :id',
      ExpressionAttributeNames: {
        '#id': 'id',
      },
      ExpressionAttributeValues: {
        ':id': userId,
      },
      ScanIndexForward: false,
      Limit: 10,
      ExclusiveStartKey: exclusiveStartKey,
    })
  );

  const jobs = res.Items as VideoJob[];

  // Check the latest status of InProgress jobs
  for (const job of jobs) {
    if (job.status === 'InProgress') {
      const newStatus = await checkAndUpdateJob(job);
      job.status = newStatus;
    }
  }

  return {
    data: jobs,
    lastEvaluatedKey: res.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString('base64')
      : undefined,
  };
};

export const deleteVideoJob = async (
  _userId: string,
  createdDate: string
): Promise<void> => {
  const userId = `videoJob#${_userId}`;

  await dynamoDbDocument.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        id: userId,
        createdDate,
      },
    })
  );
};
