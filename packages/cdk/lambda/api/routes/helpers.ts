// Temporal Adapter to preserve lambda handler API GatewayProxyEvent
// TODO: refactor each handler and remove this adapter

import { Request, Response } from 'express';
import { APIGatewayProxyEvent } from 'aws-lambda';

interface RequestWithApiGateway extends Request {
  apiGateway?: {
    event?: {
      requestContext?: APIGatewayProxyEvent['requestContext'];
    };
  };
}

type LambdaHandler = (event: APIGatewayProxyEvent) => Promise<{
  statusCode: number;
  body?: string;
  headers?: Record<string, string | boolean | number>;
}>;

export const wrapHandler =
  (
    handler: LambdaHandler,
    pathParamsFn?: (req: Request) => Record<string, string>
  ) =>
  async (req: Request, res: Response) => {
    try {
      const event = createEvent(
        req,
        pathParamsFn?.(req) ?? {}
      ) as APIGatewayProxyEvent;

      const result = await handler(event);

      if (result.headers) {
        for (const [key, value] of Object.entries(result.headers)) {
          res.setHeader(key, String(value));
        }
      }

      if (result.statusCode === 204 || !result.body) {
        res.status(result.statusCode).send();
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.status(result.statusCode).send(result.body);
      }
    } catch (error) {
      console.error('Handler error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

// createEvent is still needed for agentBuilder which has custom logic
export const createEvent = (
  req: Request,
  pathParams: Record<string, string> = {}
): Partial<APIGatewayProxyEvent> => ({
  requestContext: (req as RequestWithApiGateway)?.apiGateway?.event
    ?.requestContext,
  httpMethod: req.method,
  pathParameters: pathParams,
  queryStringParameters: req.query as Record<string, string>,
  headers: req.headers as Record<string, string>,
  body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
});
