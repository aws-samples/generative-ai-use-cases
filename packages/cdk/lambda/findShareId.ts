import { Request, Response } from 'express';
import { requireUserName, sendJson, sendText } from './utils/http';
import { findShareId } from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId: string = requireUserName(request);
  const chatId = request.params.chatId;
  const res = await findShareId(userId, chatId);

  if (res === null) {
    return sendText(response, 204);
  }

  return sendJson(response, 200, res);
};
