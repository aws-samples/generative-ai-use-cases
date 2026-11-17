import { Request, Response } from 'express';
import { requireUserName, sendText } from './utils/http';
import { deleteSystemContext } from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId: string = requireUserName(request);
  const systemContextId = request.params.systemContextId;
  await deleteSystemContext(userId, systemContextId);

  return sendText(response, 204);
};
