import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 8080;

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
app.use(
  cors({
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
  })
);

// Extract API Gateway event from Lambda Web Adapter
app.use(
  (
    req: express.Request & {
      apiGateway?: { event?: { requestContext?: unknown } };
    },
    res,
    next
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
        res
          .status(401)
          .json({ error: 'Unauthorized: missing request context' });
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
          },
        },
      };
    }
    next();
  }
);

app.use(express.json({ limit: '10mb' }));

// Import route handlers
import { router as predictRouter } from './routes/predict';
import { router as chatsRouter } from './routes/chats';
import { router as systemContextsRouter } from './routes/systemContexts';
import { router as imageRouter } from './routes/image';
import { router as videoRouter } from './routes/video';
import { router as webTextRouter } from './routes/webText';
import { router as sharesRouter } from './routes/shares';
import { router as fileRouter } from './routes/file';
import { router as tokenUsageRouter } from './routes/tokenUsage';
import { router as useCasesRouter } from './routes/useCases';
import { router as ragRouter } from './routes/rag';
import { router as ragKnowledgeBaseRouter } from './routes/ragKnowledgeBase';
import { router as agentBuilderRouter } from './routes/agentBuilder';
import { router as transcribeRouter } from './routes/transcribe';
import { router as meetingMinutesRouter } from './routes/meetingMinutes';
import { router as speechToSpeechRouter } from './routes/speechToSpeech';
import { router as pollyRouter } from './routes/polly';

// Mount routes
app.use('/predict', predictRouter);
app.use('/chats', chatsRouter);
app.use('/systemcontexts', systemContextsRouter);
app.use('/image', imageRouter);
app.use('/video', videoRouter);
app.use('/web-text', webTextRouter);
app.use('/shares', sharesRouter);
app.use('/file', fileRouter);
app.use('/token-usage', tokenUsageRouter);
app.use('/usecases', useCasesRouter);
app.use('/rag', ragRouter);
app.use('/rag-knowledge-base', ragKnowledgeBaseRouter);
app.use('/agents', agentBuilderRouter);
app.use('/transcribe', transcribeRouter);
app.use('/meeting-minutes', meetingMinutesRouter);
app.use('/speech-to-speech', speechToSpeechRouter);
app.use('/polly', pollyRouter);

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: express.NextFunction
  ) => {
    console.error('Express error:', err);
    res
      .status(500)
      .json({ error: 'Internal server error', message: err.message });
  }
);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
