import { Request, Response } from 'express';
import { requireUserName, sendResponse } from './utils/http';
import { UpdateTitleRequest } from 'generative-ai-use-cases';
import { findChatById, setChatTitle } from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId: string = requireUserName(request);
    const chatId = request.params.chatId;
    const req: UpdateTitleRequest = request.body ?? {};

    const chatItem = await findChatById(userId, chatId);

    if (!chatItem) {
      return sendResponse(response, 404, '');
    }

    const updatedChat = await setChatTitle(
      chatItem?.id,
      chatItem?.createdDate,
      req.title,
      req.usecase
    );

    return sendResponse(response, 200, JSON.stringify({ chat: updatedChat }));
  } catch (error) {
    console.log(error);
    return sendResponse(
      response,
      500,
      JSON.stringify({ message: 'Internal Server Error' })
    );
  }
};
