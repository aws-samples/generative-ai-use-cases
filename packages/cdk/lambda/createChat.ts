import { Request, Response } from 'express';
import { requireUserName, sendJson } from './utils/http';
import { createChat } from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId: string = requireUserName(request);
  const chat = await createChat(userId);

  return sendJson(response, 200, {
    chat,
  });
};
