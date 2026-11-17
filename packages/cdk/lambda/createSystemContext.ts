import { Request, Response } from 'express';
import { requireUserName, sendResponse } from './utils/http';
import { createSystemContext } from './repository';
import { SystemContext } from 'generative-ai-use-cases';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const req: SystemContext = request.body ?? {};
    const userId: string = requireUserName(request);
    const messages = await createSystemContext(
      userId,
      req.systemContextTitle,
      req.systemContext
    );

    return sendResponse(
      response,
      200,
      JSON.stringify({
        messages,
      })
    );
  } catch (error) {
    console.log(error);
    return sendResponse(
      response,
      500,
      JSON.stringify({ message: 'Internal Server Error' })
    );
  }
};
