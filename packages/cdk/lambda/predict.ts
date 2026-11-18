import { Request, Response } from 'express';
import { PredictRequest } from 'generative-ai-use-cases';
import api from './utils/api';
import { defaultModel } from './utils/models';
import { getUserSub, sendJson } from './utils/http';
import { bedrockRequestMetadata } from './utils/requestMetadata';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const req: PredictRequest = request.body ?? {};
  const model = req.model || defaultModel;
  const output = await api[model.type].invoke?.(
    model,
    req.messages,
    req.id,
    bedrockRequestMetadata({ userSub: getUserSub(request), id: req.id })
  );

  return sendJson(response, 200, output);
};
