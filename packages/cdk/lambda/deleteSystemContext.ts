import { Request, Response } from 'express';
import { requireUserName, sendResponse } from './utils/http';
import { deleteSystemContext } from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId: string = requireUserName(request);
    const systemContextId = request.params.systemContextId;
    await deleteSystemContext(userId, systemContextId);

    return sendResponse(response, 204, '');
  } catch (error) {
    console.log(error);
    return sendResponse(
      response,
      500,
      JSON.stringify({ message: 'Internal Server Error' })
    );
  }
};
