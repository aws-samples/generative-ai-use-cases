import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  PredictTitleRequest,
  UnrecordedMessage,
} from 'generative-ai-use-cases';
import { setChatTitle } from './repository';
import api from './utils/api';
import { defaultModel } from './utils/models';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      throw new Error('Request body is missing');
    }

    const req = JSON.parse(event.body) as PredictTitleRequest;

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
      (await api['bedrock'].invoke?.(model, messages, req.id)) ?? '';
    const outputMatch = rawTitle.match(/<output>([\s\S]*?)<\/output>/);
    const title = outputMatch
      ? outputMatch[1].trim()
      : rawTitle.replace(/<([^>]+)>[\s\S]*?<\/\1>/g, '').trim();

    await setChatTitle(
      req.chat.id,
      req.chat.createdDate,
      title,
      req.chat.usecase
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: title,
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};
