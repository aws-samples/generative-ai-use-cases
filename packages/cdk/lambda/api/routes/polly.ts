import { Router } from 'express';
import { handler as pollyVoicesHandler } from '../../pollyVoices';
import { handler as pollySynthesizeHandler } from '../../pollySynthesize';
import { wrapHandler } from './helpers';

export const router = Router();

router.get('/voices', wrapHandler(pollyVoicesHandler));
router.post('/synthesize', wrapHandler(pollySynthesizeHandler));
