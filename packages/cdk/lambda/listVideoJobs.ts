import { Request, Response } from 'express';
import { queryParams, requireUserName, sendResponse } from './utils/http';
import { listVideoJobs } from './repositoryVideoJob';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId: string = requireUserName(request);
    const exclusiveStartKey = queryParams(request)?.exclusiveStartKey;
    const res = await listVideoJobs(userId, exclusiveStartKey);

    return sendResponse(response, 200, JSON.stringify(res));
  } catch (error) {
    console.log(error);
    return sendResponse(
      response,
      500,
      JSON.stringify({ message: 'Internal Server Error' })
    );
  }
};
