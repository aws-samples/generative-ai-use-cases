import { Request, Response } from 'express';
import { sendResponse } from './utils/http';
import { findUserIdAndChatId, findChatById, listMessages } from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const shareId = request.params.shareId;
    const res = await findUserIdAndChatId(shareId);

    if (res === null) {
      return sendResponse(response, 404, '');
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

    return sendResponse(
      response,
      200,
      JSON.stringify({
        chat,
        messages,
      })
    );
  } catch (error) {
    console.log(error);
    return sendResponse(
      response,
      500,
      JSON.stringify({ message: 'Internal Server Error' })
    );
  }
};
