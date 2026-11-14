import { Router } from 'express';
import { handler as getAdminTokenUsageHandler } from '../../getAdminTokenUsage';
import { route } from '../../utils/http';

export const router = Router();

router.get('/token-usage', route(getAdminTokenUsageHandler));
