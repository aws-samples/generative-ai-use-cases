import { Request, Response } from 'express';
import { requireUserName, sendJson } from '../utils/http';
import { getUseCase } from './useCaseBuilderRepository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId: string = requireUserName(request);
  const useCaseId = request.params.useCaseId;

  const useCase = await getUseCase(userId, useCaseId);

  if (!useCase) {
    return sendJson(response, 404, { message: 'Use case not found' });
  }

  return sendJson(response, 200, useCase);
};
