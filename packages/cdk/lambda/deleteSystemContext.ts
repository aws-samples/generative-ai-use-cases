import { Request, Response } from 'express';
import { requireUserName, sendText } from './utils/http';
import { deleteSystemContext } from './repository';
import { deleteDefaultChat, getUserSettings } from './repositoryUserSetting';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId: string = requireUserName(request);
  const systemContextId = request.params.systemContextId;
  await deleteSystemContext(userId, systemContextId);

  // A deleted system prompt can no longer be the default for new chats
  const { defaultChat } = await getUserSettings(userId);
  if (
    defaultChat?.type === 'systemContext' &&
    defaultChat.id === systemContextId
  ) {
    await deleteDefaultChat(userId);
  }

  return sendText(response, 204);
};
