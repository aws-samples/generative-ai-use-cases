import { Request, Response } from 'express';
import { requireUserName, sendJson } from './utils/http';
import { UpdateSystemContextTitleRequest } from 'generative-ai-use-cases';
import { updateSystemContextTitle } from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId: string = requireUserName(request);
  const systemContextId = request.params.systemContextId;
  const req: UpdateSystemContextTitleRequest = request.body ?? {};
  const systemContext = await updateSystemContextTitle(
    userId,
    systemContextId,
    req.title
  );

  return sendJson(response, 200, { systemContext });
};
