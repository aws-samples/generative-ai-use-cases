import { Request, Response } from 'express';
import { requireUserName, sendJson } from '../utils/http';
import { toggleShared } from './useCaseBuilderRepository';
import { IsShared } from 'generative-ai-use-cases';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId: string = requireUserName(request);
  const useCaseId = request.params.useCaseId;

  const isShared: IsShared = await toggleShared(userId, useCaseId);

  return sendJson(response, 200, isShared);
};
