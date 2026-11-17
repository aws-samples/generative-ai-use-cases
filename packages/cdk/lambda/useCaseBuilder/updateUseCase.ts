import { Request, Response } from 'express';
import { requireUserName, sendResponse } from '../utils/http';
import { UpdateUseCaseRequest } from 'generative-ai-use-cases';
import { updateUseCase } from './useCaseBuilderRepository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId: string = requireUserName(request);
    const useCaseId = request.params.useCaseId;
    const req: UpdateUseCaseRequest = request.body ?? {};

    await updateUseCase(userId, useCaseId, req);

    return sendResponse(response, 200, '');
  } catch (error) {
    console.log(error);
    return sendResponse(
      response,
      500,
      JSON.stringify({ message: 'Internal Server Error' })
    );
  }
};
