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
} from 'generative-ai-use-cases';
import {
  GetAsyncInvokeCommand,
  ValidationException,
} from '@aws-sdk/client-bedrock-runtime';
import { CopyVideoJobParams } from './copyVideoJob';
import {
  LambdaClient,
  InvokeCommand,
  InvocationType,
} from '@aws-sdk/client-lambda';
import { initBedrockRuntimeClient } from './utils/bedrockClient';

const BUCKET_NAME: string = process.env.BUCKET_NAME!;
const TABLE_NAME: string = process.env.TABLE_NAME!;
const COPY_VIDEO_JOB_FUNCTION_ARN = process.env.COPY_VIDEO_JOB_FUNCTION_ARN!;
const dynamoDb = new DynamoDBClient({});
const dynamoDbDocument = DynamoDBDocumentClient.from(dynamoDb);
const lambda = new LambdaClient({});

export const createJob = async (
  _userId: string,
  invocationArn: string,
  req: GenerateVideoRequest
) => {
  const userId = `videoJob#${_userId}`;
  const jobId = invocationArn.split('/').slice(-1)[0];

  const params = req.params;

  // Do not save the information of the first frame image of Nova Reel in params
  if (params.images && params.images.length > 0) {
    params.images = [];
  }

  const item = {
    id: userId,
    createdDate: `${Date.now()}`,
    jobId,
    invocationArn,
    status: 'InProgress',
    output: `s3://${BUCKET_NAME}/${jobId}/output.mp4`,
    modelId: req.model!.modelId,
    region: req.model!.region,
    ...params,
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
