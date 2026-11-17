import { Request, Response } from 'express';
import { requireUserName, sendResponse } from '../utils/http';
import { toggleShared } from './useCaseBuilderRepository';
import { IsShared } from 'generative-ai-use-cases';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId: string = requireUserName(request);
    const useCaseId = request.params.useCaseId;

    const isShared: IsShared = await toggleShared(userId, useCaseId);

    return sendResponse(response, 200, JSON.stringify(isShared));
  } catch (error) {
    console.log(error);
    return sendResponse(
      response,
      500,
      JSON.stringify({ message: 'Internal Server Error' })
    );
  }
};
