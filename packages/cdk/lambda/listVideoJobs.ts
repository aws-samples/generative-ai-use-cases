import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { listVideoJobs } from './repositoryVideoJob';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const userId: string =
      event.requestContext.authorizer!.claims['cognito:username'];
    const exclusiveStartKey = event?.queryStringParameters?.exclusiveStartKey;
    const res = await listVideoJobs(userId, exclusiveStartKey);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(res),
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};
