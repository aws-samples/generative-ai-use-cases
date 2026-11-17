import { Request, Response } from 'express';
import { requireUserName, sendResponse } from './utils/http';
import { deleteVideoJob } from './repositoryVideoJob';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId: string = requireUserName(request);
    const createdDate: string = request.params.createdDate;

    await deleteVideoJob(userId, createdDate);

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
