import { Router } from 'express';
import { handler as findShareIdHandler } from '../../findShareId';
import { handler as createShareIdHandler } from '../../createShareId';
import { handler as getSharedChatHandler } from '../../getSharedChat';
import { handler as deleteShareIdHandler } from '../../deleteShareId';
import { route } from '../../utils/http';

export const router = Router();

router.get('/chat/:chatId', route(findShareIdHandler));
router.post('/chat/:chatId', route(createShareIdHandler));
router.get('/share/:shareId', route(getSharedChatHandler));
router.delete('/share/:shareId', route(deleteShareIdHandler));
