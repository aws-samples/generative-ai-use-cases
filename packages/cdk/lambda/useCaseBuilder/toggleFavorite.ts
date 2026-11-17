import { Request, Response } from 'express';
import { requireUserName, sendJson } from '../utils/http';
import { IsFavorite } from 'generative-ai-use-cases';
import { toggleFavorite } from './useCaseBuilderRepository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId: string = requireUserName(request);
  const useCaseId = request.params.useCaseId;

  const isFavorite: IsFavorite = await toggleFavorite(userId, useCaseId);

  return sendJson(response, 200, isFavorite);
};
