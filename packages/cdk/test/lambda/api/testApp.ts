import express, { Router } from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import {
  errorHandler,
  requestContextMiddleware,
} from '../../../lambda/api/middleware';
import { route } from '../../../lambda/utils/http';

/**
 * An app with the same request pipeline as `lambda/api/index.ts` (request
 * context, JSON body, error handler) and one router mounted. CORS is left out:
 * the tests call the API without an Origin header.
 */
export const createTestApp = (mountPath: string, router: Router) => {
  const app = express();
  app.use(requestContextMiddleware);
  app.use(express.json({ limit: '10mb' }));
  app.use(mountPath, router);
  app.use(errorHandler);
  return app;
};

export type ApiResponse = {
  statusCode: number;
  /** The raw response body, exactly as sent. */
  body: string;
  headers: http.IncomingHttpHeaders;
};

/**
 * Call the app over HTTP on an ephemeral 127.0.0.1 port. `user` becomes the
 * Cognito claims in the request context that Lambda Web Adapter forwards;
 * without it the request carries no request context at all.
 */
export const callApi = async (
  app: express.Express,
  params: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    user?: string;
    sub?: string;
    // A list repeats the key (?k=a&k=b)
    query?: Record<string, string | string[]>;
    body?: unknown;
    headers?: Record<string, string>;
  }
): Promise<ApiResponse> => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const { port } = server.address() as AddressInfo;
    const url = new URL(`http://127.0.0.1:${port}${params.path}`);
    for (const [key, value] of Object.entries(params.query ?? {})) {
      for (const item of [value].flat()) url.searchParams.append(key, item);
    }
    const headers: Record<string, string> = { ...(params.headers ?? {}) };
    if (params.user) {
      headers['x-amzn-request-context'] = JSON.stringify({
        authorizer: {
          claims: {
            'cognito:username': params.user,
            sub: params.sub ?? `sub-${params.user}`,
          },
        },
      });
    }
    if (params.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    // node:http rather than fetch, so suites that mock the global fetch (the
    // handler's own outbound calls) do not intercept the test request.
    return await new Promise<ApiResponse>((resolve, reject) => {
      const req = http.request(
        url,
        { method: params.method, headers },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () =>
            resolve({
              statusCode: res.statusCode ?? 0,
              body: Buffer.concat(chunks).toString('utf8'),
              headers: res.headers,
            })
          );
          res.on('error', reject);
        }
      );
      req.on('error', reject);
      if (params.body !== undefined) req.write(JSON.stringify(params.body));
      req.end();
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
};

type Handler = (
  request: express.Request,
  response: express.Response
) => Promise<void>;

export type InvokeParams = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  user?: string;
  sub?: string;
  query?: Record<string, string | string[]>;
  path?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
};

/**
 * Call a single handler through the API request pipeline. `path` values become
 * Express route parameters with the same names, the way the routers declare
 * them (`/chats/:chatId` -> `request.params.chatId`).
 */
export const invokeHandler = async (
  handler: Handler,
  params: InvokeParams = {}
): Promise<ApiResponse> => {
  const names = Object.keys(params.path ?? {});
  const routePath = '/h' + names.map((name) => `/:${name}`).join('');
  const requestPath =
    '/h' +
    names.map((name) => `/${encodeURIComponent(params.path![name])}`).join('');
  const router = Router();
  router.all(routePath, route(handler));
  const app = createTestApp('/', router);
  // Without a user the request still carries a request context, only without
  // Cognito claims, so the handler (not the middleware) decides the answer.
  const headers = params.user
    ? params.headers
    : { 'x-amzn-request-context': '{}', ...(params.headers ?? {}) };
  return callApi(app, {
    method: params.method ?? (params.body === undefined ? 'GET' : 'POST'),
    path: requestPath,
    user: params.user,
    sub: params.sub,
    query: params.query,
    body: params.body,
    headers,
  });
};
