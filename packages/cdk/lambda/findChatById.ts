import { Request, Response } from 'express';
import { requireUserName, sendJson } from './utils/http';
import { findChatById } from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId: string = requireUserName(request);
  const chatId = request.params.chatId;
  const chat = await findChatById(userId, chatId);

  return sendJson(response, 200, {
    chat,
  });
};
