import { Request, Response } from 'express';
import { deleteShareId } from './repository';
import { sendText } from './utils/http';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const shareId = request.params.shareId;

  await deleteShareId(shareId);

  return sendText(response, 204);
};
