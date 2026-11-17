import { Request, Response } from 'express';
import { requireUserName, sendJson } from '../utils/http';
import { CreateUseCaseRequest } from 'generative-ai-use-cases';
import { createUseCase } from './useCaseBuilderRepository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const req: CreateUseCaseRequest = request.body ?? {};
  const userId: string = requireUserName(request);
  const useCase = await createUseCase(userId, req);

  return sendJson(response, 200, useCase);
};
