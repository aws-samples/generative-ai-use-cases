import { Request, Response } from 'express';
import { queryParams, requireUserName, sendJson } from '../utils/http';
import { listUseCases } from './useCaseBuilderRepository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId: string = requireUserName(request);
  const exclusiveStartKey = queryParams(request)?.exclusiveStartKey;
  const res = await listUseCases(userId, exclusiveStartKey);

  return sendJson(response, 200, res);
};
