import { Request, Response } from 'express';
import { getUserSub, sendJson, sendText } from './utils/http';
import { bedrockRequestMetadata } from './utils/requestMetadata';
import { GenerateImageRequest } from 'generative-ai-use-cases';
import api from './utils/api';
import { defaultImageGenerationModel } from './utils/models';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const req: GenerateImageRequest = request.body ?? {};
    const model = req.model || defaultImageGenerationModel;
    const res = await api[model.type].generateImage(
      model,
      req.params,
      bedrockRequestMetadata({ userSub: getUserSub(request), id: '/image' })
    );

    return sendText(response, 200, res);
  } catch (error) {
    console.log(error);
    return sendJson(response, 500, { message: (error as Error).message });
  }
};
