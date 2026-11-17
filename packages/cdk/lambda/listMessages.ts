import { Request, Response } from 'express';
import { requireUserName, sendResponse } from './utils/http';
import { findChatById, listMessages } from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId: string = requireUserName(request);
    const chatId = request.params.chatId;
    const chat = await findChatById(userId, chatId);

    if (chat === null) {
      return sendResponse(
        response,
        403,
        JSON.stringify({ message: 'Forbidden' })
      );
    }

    const messages = await listMessages(chatId);

    return sendResponse(
      response,
      200,
      JSON.stringify({
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
