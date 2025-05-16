import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateFeedbackRequest } from 'generative-ai-use-cases';
import { listMessages, updateFeedback } from './repository';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const chatId = event.pathParameters!.chatId!;
    const req: UpdateFeedbackRequest = JSON.parse(event.body!);
    const userId: string =
      event.requestContext.authorizer!.claims['cognito:username'];

    // Authorization check: verify that this message belongs to the user's chat
    const messages = await listMessages(chatId);

    // Find a message that matches the createdDate (message ID) in the request
    const targetMessage = messages.find(
      (m) => m.createdDate === req.createdDate
    );

    // Return 403 if the message doesn't exist or doesn't belong to the user
    if (!targetMessage || targetMessage.userId !== `user#${userId}`) {
      console.warn(
        `Authorization error: User ${userId} attempted to provide feedback on message ${req.createdDate} in chat ${chatId} belonging to another user`
      );
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message:
            'You do not have permission to provide feedback on this message.',
        }),
      };
    }

    const message = await updateFeedback(chatId, req);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message }),
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
