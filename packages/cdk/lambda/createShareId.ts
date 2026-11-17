import { Request, Response } from 'express';
import { requireUserName, sendResponse } from './utils/http';
import { createShareId, findChatById } from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId: string = requireUserName(request);
    const chatId = request.params.chatId;

    // Authorization check: Verify if the specified chat belongs to the user
    const chat = await findChatById(userId, chatId);
    if (chat === null) {
      return sendResponse(
        response,
        403,
        JSON.stringify({
          message: 'You do not have permission to share this chat.',
        })
      );
    }

    const share = await createShareId(userId, chatId);

    return sendResponse(response, 200, JSON.stringify(share));
  } catch (error) {
    console.log(error);
    return sendResponse(
      response,
      500,
      JSON.stringify({ message: 'Internal Server Error' })
    );
  }
};
