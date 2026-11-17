import { Request, Response } from 'express';
import { PredictRequest } from 'generative-ai-use-cases';
import api from './utils/api';
import { defaultModel } from './utils/models';
import { sendJson } from './utils/http';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const req: PredictRequest = request.body ?? {};
  const model = req.model || defaultModel;
  const output = await api[model.type].invoke?.(model, req.messages, req.id);

  return sendJson(response, 200, output);
};
