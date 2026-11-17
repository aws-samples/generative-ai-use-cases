import { Request, Response } from 'express';
import { requireUserName, sendResponse } from './utils/http';
import { UpdateSystemContextTitleRequest } from 'generative-ai-use-cases';
import { updateSystemContextTitle } from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId: string = requireUserName(request);
    const systemContextId = request.params.systemContextId;
    const req: UpdateSystemContextTitleRequest = request.body ?? {};
    const systemContext = await updateSystemContextTitle(
      userId,
      systemContextId,
      req.title
    );

    return sendResponse(response, 200, JSON.stringify({ systemContext }));
  } catch (error) {
    console.log(error);
    return sendResponse(
      response,
      500,
      JSON.stringify({ message: 'Internal Server Error' })
    );
  }
};
