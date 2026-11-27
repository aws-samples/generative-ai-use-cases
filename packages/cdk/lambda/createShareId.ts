import { Request, Response } from 'express';
import { requireUserName, requireUserSub, sendJson } from './utils/http';
import { createShareId, findChatById } from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId: string = requireUserName(request);
  const chatId = request.params.chatId;

  // Authorization check: Verify if the specified chat belongs to the user
  const chat = await findChatById(userId, chatId);
  if (chat === null) {
    return sendJson(response, 403, {
      message: 'You do not have permission to share this chat.',
    });
  }

  const share = await createShareId(userId, chatId, requireUserSub(request));

  return sendJson(response, 200, share);
};
