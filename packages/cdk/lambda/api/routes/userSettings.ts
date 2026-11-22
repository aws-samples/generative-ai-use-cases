import { Router } from 'express';
import {
  deleteDefaultChatHandler,
  getHandler,
  putDefaultChatHandler,
} from '../../userSettings';
import { route } from '../../utils/http';

export const router = Router();

router.get('/', route(getHandler));
router.put('/default-chat', route(putDefaultChatHandler));
router.delete('/default-chat', route(deleteDefaultChatHandler));
