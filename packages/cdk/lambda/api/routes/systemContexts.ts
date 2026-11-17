import { Router } from 'express';
import { handler as createSystemContextHandler } from '../../createSystemContext';
import { handler as listSystemContextsHandler } from '../../listSystemContexts';
import { handler as deleteSystemContextHandler } from '../../deleteSystemContext';
import { handler as updateSystemContextTitleHandler } from '../../updateSystemContextTitle';
import { route } from '../../utils/http';

export const router = Router();

router.post('/', route(createSystemContextHandler));
router.get('/', route(listSystemContextsHandler));
router.delete('/:systemContextId', route(deleteSystemContextHandler));
router.put('/:systemContextId/title', route(updateSystemContextTitleHandler));
