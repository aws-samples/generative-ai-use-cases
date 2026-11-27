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
  // Files are passed to models through PredictStream, which checks who may
  // read them. This route takes no S3 references.
  if (
    req.messages?.some((message) =>
      message.extraData?.some((extra) => extra?.source?.type === 's3')
    )
  ) {
    return sendJson(response, 400, {
      message: 'S3 references are not supported',
    });
  }
  const model = req.model || defaultModel;
  const output = await api[model.type].invoke?.(
    model,
    req.messages,
    req.id,
    bedrockRequestMetadata({ userSub: getUserSub(request), id: req.id })
  );

  return sendJson(response, 200, output);
};
