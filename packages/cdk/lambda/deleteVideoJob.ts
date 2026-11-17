import { Request, Response } from 'express';
import { requireUserName, sendText } from './utils/http';
import { deleteVideoJob } from './repositoryVideoJob';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId: string = requireUserName(request);
  const createdDate: string = request.params.createdDate;

  await deleteVideoJob(userId, createdDate);

  return sendText(response, 204);
};
