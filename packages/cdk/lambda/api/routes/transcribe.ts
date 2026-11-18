import { Router } from 'express';
import { handler as startTranscriptionHandler } from '../../startTranscription';
import { handler as getTranscriptionHandler } from '../../getTranscription';
import { handler as getSignedUrlHandler } from '../../getFileUploadSignedUrl';
import { route } from '../../utils/http';

export const router = Router();

router.post('/start', route(startTranscriptionHandler));
router.post('/url', route(getSignedUrlHandler));
router.get('/result/:jobName', route(getTranscriptionHandler));
