import { Request, Response } from 'express';
import { requireUserName, sendJson } from './utils/http';
import { createSystemContext } from './repository';
import { SystemContext } from 'generative-ai-use-cases';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const req: SystemContext = request.body ?? {};
  const userId: string = requireUserName(request);
  const messages = await createSystemContext(
    userId,
    req.systemContextTitle,
    req.systemContext
  );

  return sendJson(response, 200, {
    messages,
  });
};
