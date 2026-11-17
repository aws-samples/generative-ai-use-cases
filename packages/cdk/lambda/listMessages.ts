import { Request, Response } from 'express';
import { requireUserName, sendJson } from './utils/http';
import { findChatById, listMessages } from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId: string = requireUserName(request);
  const chatId = request.params.chatId;
  const chat = await findChatById(userId, chatId);

  if (chat === null) {
    return sendJson(response, 403, { message: 'Forbidden' });
  }

  const messages = await listMessages(chatId);

  return sendJson(response, 200, {
    messages,
  });
};
