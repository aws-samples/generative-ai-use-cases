import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { findUserIdAndChatId, findChatById, listMessages } from './repository';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const shareId = event.pathParameters!.shareId!;
    const res = await findUserIdAndChatId(shareId);

    if (res === null) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: '',
      };
    }

    const userId = res.userId;
    const chatId = res.chatId;

    const chat = await findChatById(
      // SAML authentication includes # in userId
      // Example: user#EntraID_hogehoge.com#EXT#@hogehoge.onmicrosoft.com
      userId.split('#').slice(1).join('#'),
      chatId.split('#')[1]
    );
    const messages = await listMessages(chatId.split('#')[1]);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        chat,
        messages,
      }),
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
