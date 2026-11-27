import { Request, Response } from 'express';
import { deleteShareId, findUserIdAndChatId } from './repository';
import { requireUserName, sendJson, sendText } from './utils/http';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const shareId = request.params.shareId;
  const share = await findUserIdAndChatId(shareId);

  // Only the owner of the shared chat may revoke its link.
  // SAML user ids contain `#` themselves, so only the leading `user#`
  // partition prefix is removed.
  const owner = share?.userId.split('#').slice(1).join('#');
  if (!share || !owner || owner !== requireUserName(request)) {
    return sendJson(response, 403, { message: 'Forbidden' });
  }

  await deleteShareId(shareId);

  return sendText(response, 204);
};
