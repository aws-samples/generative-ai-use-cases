import express from 'express';
import cors from 'cors';
import { APIGatewayProxyEvent } from 'aws-lambda';

/** The request after `requestContextMiddleware` has run. */
export type RequestWithApiGateway = express.Request & {
  apiGateway?: {
    event?: { requestContext?: APIGatewayProxyEvent['requestContext'] };
  };
};

// CORS middleware
// Browsers lowercase the host portion of the Origin header per RFC, so we
// compare case-insensitively — otherwise an ALB DNS name like
// `internal-Closed-Close-...elb.amazonaws.com` (preserved from CDK construct
// IDs) won't match the browser-sent `internal-closed-close-...` origin.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
      .map((o) => o.trim().toLowerCase())
      .filter((o) => o.length > 0)
  : [];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Reject if no allowed origins configured (misconfiguration guard)
    if (allowedOrigins.length === 0) {
      callback(new Error('No CORS origins configured'));
      return;
    }
    if (
      !origin ||
      allowedOrigins.includes('*') ||
      allowedOrigins.includes(origin.toLowerCase())
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-amzn-request-context'],
});

// Extract API Gateway event from Lambda Web Adapter
export const requestContextMiddleware = (
  req: RequestWithApiGateway,
  res: express.Response,
  next: express.NextFunction
) => {
  // Lambda Web Adapter passes the API Gateway request context in x-amzn-request-context header
  const requestContextHeader = req.headers['x-amzn-request-context'];

  if (requestContextHeader) {
    try {
      const requestContext = JSON.parse(requestContextHeader as string);
      req.apiGateway = {
        event: {
          requestContext: requestContext,
        },
      };
    } catch (e) {
      console.error('Failed to parse request context:', e);
    }
  } else {
    // Local development only: Mock API Gateway event
    if (process.env.NODE_ENV !== 'development') {
      res.status(401).json({ error: 'Unauthorized: missing request context' });
      return;
    }
    req.apiGateway = {
      event: {
        requestContext: {
          authorizer: {
            claims: {
              sub: 'local-user-id',
              'cognito:username': 'local-user',
              email: 'local@example.com',
            },
          },
        } as unknown as APIGatewayProxyEvent['requestContext'],
      },
    };
  }
  next();
};

// Error handler
export const errorHandler = (
  err: Error,
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  console.error('Express error:', err);
  // A response that has started cannot change its status; Express's default
  // handler closes the connection instead.
  if (res.headersSent) {
    next(err);
    return;
  }
  res
    .status(500)
    .json({ error: 'Internal server error', message: err.message });
};
