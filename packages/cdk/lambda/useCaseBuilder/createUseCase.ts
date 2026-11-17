import { Request, Response } from 'express';
import { requireUserName, sendResponse } from '../utils/http';
import { CreateUseCaseRequest } from 'generative-ai-use-cases';
import { createUseCase } from './useCaseBuilderRepository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const req: CreateUseCaseRequest = request.body ?? {};
    const userId: string = requireUserName(request);
    const useCase = await createUseCase(userId, req);

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
