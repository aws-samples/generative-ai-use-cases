import { Request, Response } from 'express';
import { requireUserName, sendResponse } from './utils/http';
import { deleteChat, deleteShareId, findShareId } from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId: string = requireUserName(request);
    const chatId = request.params.chatId;
    await deleteChat(userId, chatId);

    const shareId = await findShareId(userId, chatId);

    if (shareId) {
      await deleteShareId(shareId.shareId.split('#')[1]);
    }

    return sendResponse(response, 204, '');
  } catch (error) {
    console.log(error);
    return sendResponse(
      response,
      500,
      JSON.stringify({ message: 'Internal Server Error' })
    );
  }
};
