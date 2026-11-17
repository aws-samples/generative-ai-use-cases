import { Request, Response } from 'express';
import { PredictRequest } from 'generative-ai-use-cases';
import api from './utils/api';
import { defaultModel } from './utils/models';
import { sendResponse } from './utils/http';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const req: PredictRequest = request.body ?? {};
    const model = req.model || defaultModel;
    const output = await api[model.type].invoke?.(model, req.messages, req.id);

    return sendResponse(response, 200, JSON.stringify(output));
  } catch (error) {
    console.log(error);
    return sendResponse(
      response,
      500,
      JSON.stringify({ message: 'Internal Server Error' })
    );
  }
};
