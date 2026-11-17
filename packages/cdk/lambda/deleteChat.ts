import { Request, Response } from 'express';
import { requireUserName, sendText } from './utils/http';
import { deleteChat, deleteShareId, findShareId } from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId: string = requireUserName(request);
  const chatId = request.params.chatId;
  await deleteChat(userId, chatId);

  const shareId = await findShareId(userId, chatId);

  if (shareId) {
    await deleteShareId(shareId.shareId.split('#')[1]);
  }

  return sendText(response, 204);
};
