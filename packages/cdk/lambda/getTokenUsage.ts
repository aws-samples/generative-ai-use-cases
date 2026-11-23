import { Request, Response } from 'express';
import { queryParams, requireUserName, sendJson } from './utils/http';
import { aggregateTokenUsage } from './repository';
import { withEstimatedCost } from './utils/tokenUsage';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    // Get user ID from Cognito
    const userId = requireUserName(request);
    const { startDate, endDate } = queryParams(request) || {};

    if (!startDate || !endDate) {
      return sendJson(response, 400, {
        message: 'startDate and endDate parameters are required',
      });
    }

    // Get aggregated data for the specified period
    const stats = await aggregateTokenUsage(startDate, endDate, [userId]);

    return sendJson(response, 200, stats.map(withEstimatedCost));
  } catch (error) {
    console.error('Error getting token usage statistics:', error);
    return sendJson(response, 500, {
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
