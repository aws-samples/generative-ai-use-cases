import { Router } from 'express';
import { handler as queryKendraHandler } from '../../queryKendra';
import { handler as retrieveKendraHandler } from '../../retrieveKendra';
import { route } from '../../utils/http';

export const router = Router();

router.post('/query', route(queryKendraHandler));
router.post('/retrieve', route(retrieveKendraHandler));
