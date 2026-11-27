import { Request, Response } from 'express';
import {
  PredictTitleRequest,
  UnrecordedMessage,
} from 'generative-ai-use-cases';
import { findChatById, setChatTitle } from './repository';
import api from './utils/api';
import { defaultModel } from './utils/models';
import { getUserSub, requireUserName, sendJson, sendText } from './utils/http';
import { bedrockRequestMetadata } from './utils/requestMetadata';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  if (!request.body) {
    throw new Error('Request body is missing');
  }

  const req = request.body as PredictTitleRequest;

  console.log(
    'predictTitle request:',
    JSON.stringify({
      hasPrompt: !!req.prompt,
      chatId: req.chat?.chatId,
      chatPK: req.chat?.id,
      createdDate: req.chat?.createdDate,
      usecase: req.chat?.usecase,
      id: req.id,
    })
  );

  // Validation
  if (!req.prompt || !req.chat?.id || !req.chat?.createdDate || !req.id) {
    throw new Error('Invalid request format');
  }

  // The title is written to the caller's own chat, looked up by its id; the
  // record key in the request is not used.
  const chatId = req.chat.chatId?.startsWith('chat#')
    ? req.chat.chatId.slice('chat#'.length)
    : undefined;
  const chat = chatId
    ? await findChatById(requireUserName(request), chatId)
    : null;
  if (!chat) {
    return sendJson(response, 403, { message: 'Forbidden' });
  }

  // Use the lightweight default model for title generation
  const model = defaultModel;

  // Add a question for title setting
  const messages: UnrecordedMessage[] = [
    {
      role: 'user',
      content: req.prompt,
    },
  ];

  // When adding a new model, the default Claude prompter is used, so the output may be enclosed in <output></output>
  // Some reasoning models (e.g. Opus 4.5) may also output <thinking>...</thinking> before the actual title.
  // Extract specifically from <output> tags if present, otherwise strip all XML tags.
  const rawTitle =
    (await api['bedrock'].invoke?.(
      model,
      messages,
      req.id,
      bedrockRequestMetadata({ userSub: getUserSub(request), id: req.id })
    )) ?? '';
  const outputMatch = rawTitle.match(/<output>([\s\S]*?)<\/output>/);
  const title = outputMatch
    ? outputMatch[1].trim()
    : rawTitle.replace(/<([^>]+)>[\s\S]*?<\/\1>/g, '').trim();

  await setChatTitle(chat.id, chat.createdDate, title, req.chat.usecase);

  return sendText(response, 200, title);
};
