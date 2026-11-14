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

/** The caller's Cognito `sub`, or undefined without Cognito claims. */
export const getUserSub = (request: Request): string | undefined =>
  claims(request)?.sub || undefined;

/** The raw id token the web client sends in `Authorization`. */
export const idTokenFromRequest = (request: Request): string | undefined => {
  const value = request.headers['authorization'];
  return value ? value.replace(/^Bearer\s+/i, '') : undefined;
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
 * Send `body` as it is, with the JSON content type the web client expects
 * (signed URLs and base64 images are plain strings it reads as text). An empty
 * body sends no body; Express drops the content type of a 204 itself.
 */
export const sendText = (
  response: Response,
  statusCode: number,
  body = ''
): void => {
  response.setHeader('Content-Type', 'application/json');
  if (!body) {
    response.status(statusCode).send();
    return;
  }
  response.status(statusCode).send(body);
};

/** Send `value` serialized with `JSON.stringify`. */
export const sendJson = (
  response: Response,
  statusCode: number,
  value: unknown
): void => sendText(response, statusCode, JSON.stringify(value));

/**
 * Express 4 does not await handlers, so a rejected promise would never reach
 * an error handler. Answer it here with the 500 body the handlers send, without
 * error details; handlers only catch errors they answer differently.
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
      sendJson(response, 500, { message: 'Internal Server Error' });
    });
  }) as RequestHandler;
