import { Request, Response } from 'express';
import { requireUserName, sendText } from '../utils/http';
import { deleteUseCase } from './useCaseBuilderRepository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId: string = requireUserName(request);
  const useCaseId = request.params.useCaseId;

  await deleteUseCase(userId, useCaseId);

  return sendText(response, 204);
};
