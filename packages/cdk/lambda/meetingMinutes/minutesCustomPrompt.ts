import { Request, Response } from 'express';
import { requireUserName, sendJson, sendText } from '../utils/http';
import { UpdateMeetingMinutesCustomPromptRequest } from 'generative-ai-use-cases';
import {
  listMeetingMinutesCustomPrompts,
  createMeetingMinutesCustomPrompt,
  updateMeetingMinutesCustomPrompt,
  deleteMeetingMinutesCustomPrompt,
} from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId: string = requireUserName(request);
  const method = request.method;

  if (method === 'GET') {
    const items = await listMeetingMinutesCustomPrompts(userId);
    return sendJson(response, 200, items);
  }

  if (method === 'POST') {
    const req = request.body ?? {};
    const prompt = await createMeetingMinutesCustomPrompt(
      userId,
      req.meetingMinutesCustomPromptTitle,
      req.meetingMinutesCustomPromptBody
    );
    return sendJson(response, 200, { meetingMinutesCustomPrompt: prompt });
  }

  if (method === 'PUT') {
    const id = request.params.id;
    const req: UpdateMeetingMinutesCustomPromptRequest = request.body ?? {};
    const prompt = await updateMeetingMinutesCustomPrompt(
      userId,
      id,
      req.meetingMinutesCustomPromptTitle,
      req.meetingMinutesCustomPromptBody
    );
    return sendJson(response, 200, { meetingMinutesCustomPrompt: prompt });
  }

  if (method === 'DELETE') {
    const id = request.params.id;
    await deleteMeetingMinutesCustomPrompt(userId, id);
    return sendText(response, 204);
  }

  return sendJson(response, 405, { message: 'Method Not Allowed' });
};
