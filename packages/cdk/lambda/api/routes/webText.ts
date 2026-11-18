import { Router } from 'express';
import { handler as getWebTextHandler } from '../../getWebText';
import { route } from '../../utils/http';

export const router = Router();

router.get('/', route(getWebTextHandler));
