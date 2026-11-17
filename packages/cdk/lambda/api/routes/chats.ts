import { Router } from 'express';
import { handler as createChatHandler } from '../../createChat';
import { handler as listChatsHandler } from '../../listChats';
import { handler as findChatByIdHandler } from '../../findChatById';
import { handler as deleteChatHandler } from '../../deleteChat';
import { handler as updateTitleHandler } from '../../updateTitle';
import { handler as listMessagesHandler } from '../../listMessages';
import { handler as createMessagesHandler } from '../../createMessages';
import { handler as updateFeedbackHandler } from '../../updateFeedback';
import { route } from '../../utils/http';

export const router = Router();

router.post('/', route(createChatHandler));
router.get('/', route(listChatsHandler));
router.get('/:chatId', route(findChatByIdHandler));
router.delete('/:chatId', route(deleteChatHandler));
router.put('/:chatId/title', route(updateTitleHandler));
router.get('/:chatId/messages', route(listMessagesHandler));
router.post('/:chatId/messages', route(createMessagesHandler));
router.post('/:chatId/feedbacks', route(updateFeedbackHandler));
