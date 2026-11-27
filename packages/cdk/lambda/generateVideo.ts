import { Request, Response } from 'express';
import { requireUserName, requireUserSub, sendJson } from './utils/http';
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

    const res = await createJob(
      userId,
      requireUserSub(request),
      invocationArn,
      req
    );

    return sendJson(response, 200, res);
  } catch (error) {
    console.log(error);
    return sendJson(response, 500, { message: (error as Error).message });
  }
};
