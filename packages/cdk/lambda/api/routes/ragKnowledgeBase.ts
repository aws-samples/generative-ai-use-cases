import { Router } from 'express';
import { handler as retrieveKnowledgeBaseHandler } from '../../retrieveKnowledgeBase';
import { route } from '../../utils/http';

export const router = Router();

router.post('/retrieve', route(retrieveKnowledgeBaseHandler));
