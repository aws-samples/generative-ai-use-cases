import { NextFunction, Request, RequestHandler, Response } from 'express';
import type { RequestWithApiGateway } from '../api/middleware';

// Helpers for the Express API (`lambda/api`). The caller's identity comes only
// from the request context that `requestContextMiddleware` attached.

const claims = (request: Request): Record<string, string> | undefined =>
  (request as RequestWithApiGateway).apiGateway?.event?.requestContext
    ?.authorizer?.claims;

/**
 * The caller's user name (`cognito:username`). Chat records are keyed by it.
 * Throws when the request carries no Cognito claims.
 */
export const requireUserName = (request: Request): string => {
  const userName = claims(request)?.['cognito:username'];
  if (!userName) throw new Error('The request has no Cognito user name');
  return userName;
};

/** The caller's Cognito `sub`. */
export const requireUserSub = (request: Request): string => {
  const sub = claims(request)?.sub;
  if (!sub) throw new Error('The request has no Cognito sub');
  return sub;
};

/** Query string values; repeated keys are not used by the web client. */
export const queryParams = (request: Request): Record<string, string> =>
  request.query as Record<string, string>;

/**
 * Send a JSON response: objects are serialized, strings are sent as they are
 * (signed URLs and base64 images are plain strings the client reads as text).
 * An empty body or 204 sends no body.
 */
export const sendResponse = (
  response: Response,
  statusCode: number,
  body: unknown = ''
): void => {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  if (statusCode === 204 || !text) {
    response.status(statusCode).send();
    return;
  }
  response.setHeader('Content-Type', 'application/json');
  response.status(statusCode).send(text);
};

/**
 * Express 4 does not await handlers, so a rejected promise would never reach
 * an error handler. Answer it here with the same body the API always sent for
 * an unhandled failure (no error details).
 */
export const route = (
  handler: (request: Request, response: Response) => Promise<void>
) =>
  ((request: Request, response: Response, next: NextFunction) => {
    handler(request, response).catch((error) => {
      console.error('Handler error:', error);
      if (response.headersSent) {
        next(error);
        return;
      }
      response.status(500).json({ error: 'Internal server error' });
    });
  }) as RequestHandler;
