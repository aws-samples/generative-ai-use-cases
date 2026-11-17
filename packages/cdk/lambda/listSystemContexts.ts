import { Request, Response } from 'express';
import { requireUserName, sendJson } from './utils/http';
import { listSystemContexts } from './repository';
import { SystemContext } from 'generative-ai-use-cases';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId: string = requireUserName(request);
  const systemContextItems: SystemContext[] = await listSystemContexts(userId);

  return sendJson(response, 200, systemContextItems);
};
