import { Request, Response } from 'express';
import { DefaultChat } from 'generative-ai-use-cases';
import { requireUserName, sendJson, sendText } from './utils/http';
import { findSystemContextById } from './repository';
import {
  deleteDefaultChat,
  getUserSettings,
  setDefaultChat,
} from './repositoryUserSetting';

export const getHandler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId = requireUserName(request);
  return sendJson(response, 200, await getUserSettings(userId));
};

export const putDefaultChatHandler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId = requireUserName(request);
  const body = (request.body ?? {}) as Partial<DefaultChat>;
  if (
    body.type !== 'systemContext' ||
    typeof body.id !== 'string' ||
    body.id === ''
  ) {
    return sendJson(response, 400, {
      message: 'type must be systemContext and id must be set',
    });
  }
  // Only the user's own saved system prompts can be the default
  const systemContext = await findSystemContextById(userId, body.id);
  if (!systemContext) {
    return sendJson(response, 404, { message: 'System prompt not found' });
  }
  const defaultChat: DefaultChat = { type: 'systemContext', id: body.id };
  await setDefaultChat(userId, defaultChat);
  return sendJson(response, 200, { defaultChat });
};

export const deleteDefaultChatHandler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId = requireUserName(request);
  await deleteDefaultChat(userId);
  return sendText(response, 204);
};
