import { Router } from 'express';
import { handler as getTokenUsageHandler } from '../../getTokenUsage';
import { route } from '../../utils/http';

export const router = Router();

router.get('/', route(getTokenUsageHandler));
