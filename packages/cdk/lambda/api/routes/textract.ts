import { Router } from 'express';
import { handler as detectDocumentTextHandler } from '../../detectDocumentText';
import { wrapHandler } from './helpers';

export const router = Router();

router.post('/detect', wrapHandler(detectDocumentTextHandler));
