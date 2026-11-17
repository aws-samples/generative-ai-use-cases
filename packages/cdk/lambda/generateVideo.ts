import { Request, Response } from 'express';
import { requireUserName, sendResponse } from './utils/http';
import { GenerateVideoRequest } from 'generative-ai-use-cases';
import api from './utils/api';
import { defaultVideoGenerationModel } from './utils/models';
import { createJob } from './repositoryVideoJob';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId: string = requireUserName(request);
    const req: GenerateVideoRequest = request.body ?? {};
    const model = req.model || defaultVideoGenerationModel;
    const invocationArn = await api[model.type].generateVideo(
      model,
      req.params
    );

    const res = await createJob(userId, invocationArn, req);

    return sendResponse(response, 200, JSON.stringify(res));
  } catch (error) {
    console.log(error);
    return sendResponse(
      response,
      500,
      JSON.stringify({ message: (error as Error).message })
    );
  }
};
