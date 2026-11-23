import { Request, Response } from 'express';
import { requireUserName, sendJson, sendText } from './utils/http';
import { UpdateTitleRequest } from 'generative-ai-use-cases';
import { findChatById, setChatTitle } from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId: string = requireUserName(request);
  const chatId = request.params.chatId;
  const req: UpdateTitleRequest = request.body ?? {};

  const chatItem = await findChatById(userId, chatId);

  if (!chatItem) {
    return sendText(response, 404);
  }

  const updatedChat = await setChatTitle(
    chatItem?.id,
    chatItem?.createdDate,
    req.title,
    req.usecase
  );

  return sendJson(response, 200, { chat: updatedChat });
};
