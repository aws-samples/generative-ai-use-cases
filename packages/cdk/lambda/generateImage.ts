import { Request, Response } from 'express';
import { sendResponse } from './utils/http';
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
    const res = await api[model.type].generateImage(model, req.params);

    return sendResponse(response, 200, res);
  } catch (error) {
    console.log(error);
    return sendResponse(
      response,
      500,
      JSON.stringify({ message: (error as Error).message })
    );
  }
};
