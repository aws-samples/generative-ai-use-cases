import { Request, Response } from 'express';
import { sendJson, sendText } from './utils/http';
import { findUserIdAndChatId, findChatById, listMessages } from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const shareId = request.params.shareId;
  const res = await findUserIdAndChatId(shareId);

  if (res === null) {
    return sendText(response, 404);
  }

  const userId = res.userId;
  const chatId = res.chatId;

  const chat = await findChatById(
    // SAML authentication includes # in userId
    // Example: user#EntraID_hogehoge.com#EXT#@hogehoge.onmicrosoft.com
    userId.split('#').slice(1).join('#'),
    chatId.split('#')[1]
  );
  const messages = await listMessages(chatId.split('#')[1]);

  return sendJson(response, 200, {
    chat,
    messages,
  });
};
