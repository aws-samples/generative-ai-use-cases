import { Request, Response } from 'express';
import { requireUserName, sendResponse } from '../utils/http';
import { IsFavorite } from 'generative-ai-use-cases';
import { toggleFavorite } from './useCaseBuilderRepository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId: string = requireUserName(request);
    const useCaseId = request.params.useCaseId;

    const isFavorite: IsFavorite = await toggleFavorite(userId, useCaseId);

    return sendResponse(response, 200, JSON.stringify(isFavorite));
  } catch (error) {
    console.log(error);
    return sendResponse(
      response,
      500,
      JSON.stringify({ message: 'Internal Server Error' })
    );
  }
};
