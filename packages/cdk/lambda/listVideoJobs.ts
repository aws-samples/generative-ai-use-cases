import { Request, Response } from 'express';
import { queryParams, requireUserName, sendJson } from './utils/http';
import { listVideoJobs } from './repositoryVideoJob';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId: string = requireUserName(request);
  const exclusiveStartKey = queryParams(request)?.exclusiveStartKey;
  const res = await listVideoJobs(userId, exclusiveStartKey);

  return sendJson(response, 200, res);
};
