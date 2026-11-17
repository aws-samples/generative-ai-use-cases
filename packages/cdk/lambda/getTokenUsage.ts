import { Request, Response } from 'express';
import { queryParams, requireUserName, sendResponse } from './utils/http';
import { aggregateTokenUsage } from './repository';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    // Get user ID from Cognito
    const userId = requireUserName(request);
    const { startDate, endDate } = queryParams(request) || {};

    if (!startDate || !endDate) {
      return sendResponse(
        response,
        400,
        JSON.stringify({
          message: 'startDate and endDate parameters are required',
        })
      );
    }

    // Get aggregated data for the specified period
    const stats = await aggregateTokenUsage(startDate, endDate, [userId]);

    return sendResponse(response, 200, JSON.stringify(stats));
  } catch (error) {
    console.error('Error getting token usage statistics:', error);
    return sendResponse(
      response,
      500,
      JSON.stringify({
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    );
  }
};
