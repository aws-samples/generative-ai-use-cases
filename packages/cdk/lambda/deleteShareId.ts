import { Request, Response } from 'express';
import { deleteShareId } from './repository';
import { sendResponse } from './utils/http';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const shareId = request.params.shareId;

    await deleteShareId(shareId);

    return sendResponse(response, 204, '');
  } catch (error) {
    console.log(error);
    return sendResponse(
      response,
      500,
      JSON.stringify({ message: 'Internal Server Error' })
    );
  }
};
