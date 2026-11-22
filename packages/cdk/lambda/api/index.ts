import express from 'express';
import {
  corsMiddleware,
  errorHandler,
  requestContextMiddleware,
} from './middleware';

const app = express();
const port = process.env.PORT || 8080;

app.use(corsMiddleware);
app.use(requestContextMiddleware);

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
import { router as adminRouter } from './routes/admin';

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
app.use('/admin', adminRouter);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
