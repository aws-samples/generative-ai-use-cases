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
    // The following processing removes the xml tags containing <output></output>
    const title =
      (await api['bedrock'].invoke?.(model, messages, req.id))?.replace(
        /<([^>]+)>([\s\S]*?)<\/\1>/,
        '$2'
      ) ?? '';

    await setChatTitle(req.chat.id, req.chat.createdDate, title);

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
