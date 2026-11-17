import { Router } from 'express';
import { handler as startSpeechToSpeechSessionHandler } from '../../startSpeechToSpeechSession';
import { route } from '../../utils/http';

export const router = Router();

router.post('/', route(startSpeechToSpeechSessionHandler));
