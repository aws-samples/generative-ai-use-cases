import { Request, Response } from 'express';
import { requireUserName, sendResponse } from './utils/http';
import { findShareId } from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId: string = requireUserName(request);
    const chatId = request.params.chatId;
    const res = await findShareId(userId, chatId);

    if (res === null) {
      return sendResponse(response, 204, '');
    }

    return sendResponse(response, 200, JSON.stringify(res));
  } catch (error) {
    console.log(error);
    return sendResponse(
      response,
      500,
      JSON.stringify({ message: 'Internal Server Error' })
    );
  }
};
