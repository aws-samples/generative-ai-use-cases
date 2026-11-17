import { Router } from 'express';
import { handler as predictHandler } from '../../predict';
import { handler as predictTitleHandler } from '../../predictTitle';
import { route } from '../../utils/http';

export const router = Router();

router.post('/', route(predictHandler));
router.post('/title', route(predictTitleHandler));
