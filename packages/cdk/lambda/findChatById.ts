import { Request, Response } from 'express';
import { requireUserName, sendResponse } from './utils/http';
import { findChatById } from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId: string = requireUserName(request);
    const chatId = request.params.chatId;
    const chat = await findChatById(userId, chatId);

    return sendResponse(
      response,
      200,
      JSON.stringify({
        chat,
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
