import { Request, Response } from 'express';
import { requireUserName, sendJson } from './utils/http';
import { UpdateFeedbackRequest } from 'generative-ai-use-cases';
import { listMessages, updateFeedback } from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const chatId = request.params.chatId;
  const req: UpdateFeedbackRequest = request.body ?? {};
  const userId: string = requireUserName(request);

  // Authorization check: verify that this message belongs to the user's chat
  const messages = await listMessages(chatId);

  // Find a message that matches the createdDate (message ID) in the request
  const targetMessage = messages.find((m) => m.createdDate === req.createdDate);

  // Return 403 if the message doesn't exist or doesn't belong to the user
  if (!targetMessage || targetMessage.userId !== `user#${userId}`) {
    console.warn(
      `Authorization error: User ${userId} attempted to provide feedback on message ${req.createdDate} in chat ${chatId} belonging to another user`
    );
    return sendJson(response, 403, {
      message:
        'You do not have permission to provide feedback on this message.',
    });
  }

  const message = await updateFeedback(chatId, req);

  return sendJson(response, 200, { message });
};
