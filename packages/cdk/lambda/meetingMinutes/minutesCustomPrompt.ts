import { Request, Response } from 'express';
import { requireUserName, sendResponse } from '../utils/http';
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
  try {
    const userId: string = requireUserName(request);
    const method = request.method;

    if (method === 'GET') {
      const items = await listMeetingMinutesCustomPrompts(userId);
      return sendResponse(response, 200, JSON.stringify(items));
    }

    if (method === 'POST') {
      const req = request.body ?? {};
      const prompt = await createMeetingMinutesCustomPrompt(
        userId,
        req.meetingMinutesCustomPromptTitle,
        req.meetingMinutesCustomPromptBody
      );
      return sendResponse(
        response,
        200,
        JSON.stringify({ meetingMinutesCustomPrompt: prompt })
      );
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
      return sendResponse(
        response,
        200,
        JSON.stringify({ meetingMinutesCustomPrompt: prompt })
      );
    }

    if (method === 'DELETE') {
      const id = request.params.id;
      await deleteMeetingMinutesCustomPrompt(userId, id);
      return sendResponse(response, 204, '');
    }

    return sendResponse(
      response,
      405,
      JSON.stringify({ message: 'Method Not Allowed' })
    );
  } catch (error) {
    console.log(error);
    return sendResponse(
      response,
      500,
      JSON.stringify({ message: 'Internal Server Error' })
    );
  }
};
