import { Router, Request } from 'express';
import { handler as createChatHandler } from '../../createChat';
import { handler as listChatsHandler } from '../../listChats';
import { handler as findChatByIdHandler } from '../../findChatById';
import { handler as deleteChatHandler } from '../../deleteChat';
import { handler as updateTitleHandler } from '../../updateTitle';
import { handler as listMessagesHandler } from '../../listMessages';
import { handler as createMessagesHandler } from '../../createMessages';
import { handler as deleteMessagesHandler } from '../../deleteMessages';
import { handler as updateFeedbackHandler } from '../../updateFeedback';
import { wrapHandler } from './helpers';

export const router = Router();

const chatId = (req: Request) => ({ chatId: req.params.chatId });

router.post('/', wrapHandler(createChatHandler));
router.get('/', wrapHandler(listChatsHandler));
router.get('/:chatId', wrapHandler(findChatByIdHandler, chatId));
router.delete('/:chatId', wrapHandler(deleteChatHandler, chatId));
router.put('/:chatId/title', wrapHandler(updateTitleHandler, chatId));
router.get('/:chatId/messages', wrapHandler(listMessagesHandler, chatId));
router.post('/:chatId/messages', wrapHandler(createMessagesHandler, chatId));
router.delete('/:chatId/messages', wrapHandler(deleteMessagesHandler, chatId));
router.post('/:chatId/feedbacks', wrapHandler(updateFeedbackHandler, chatId));
