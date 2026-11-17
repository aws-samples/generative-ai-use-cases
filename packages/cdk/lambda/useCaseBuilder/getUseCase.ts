import { Request, Response } from 'express';
import { requireUserName, sendResponse } from '../utils/http';
import { getUseCase } from './useCaseBuilderRepository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId: string = requireUserName(request);
    const useCaseId = request.params.useCaseId;

    const useCase = await getUseCase(userId, useCaseId);

    if (!useCase) {
      return sendResponse(
        response,
        404,
        JSON.stringify({ message: 'Use case not found' })
      );
    }

    return sendResponse(response, 200, JSON.stringify(useCase));
  } catch (error) {
    console.log(error);
    return sendResponse(
      response,
      500,
      JSON.stringify({ message: 'Internal Server Error' })
    );
  }
};
