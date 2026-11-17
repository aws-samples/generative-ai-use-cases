import { Request, Response } from 'express';
import { requireUserName, sendText } from '../utils/http';
import { UpdateUseCaseRequest } from 'generative-ai-use-cases';
import { updateUseCase } from './useCaseBuilderRepository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId: string = requireUserName(request);
  const useCaseId = request.params.useCaseId;
  const req: UpdateUseCaseRequest = request.body ?? {};

  await updateUseCase(userId, useCaseId, req);

  return sendText(response, 200);
};
