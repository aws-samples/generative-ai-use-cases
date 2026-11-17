import { Request, Response } from 'express';
import { requireUserName, sendResponse } from './utils/http';
import { listSystemContexts } from './repository';
import { SystemContext } from 'generative-ai-use-cases';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId: string = requireUserName(request);
    const systemContextItems: SystemContext[] =
      await listSystemContexts(userId);

    return sendResponse(response, 200, JSON.stringify(systemContextItems));
  } catch (error) {
    console.log(error);
    return sendResponse(
      response,
      500,
      JSON.stringify({ message: 'Internal Server Error' })
    );
  }
};
