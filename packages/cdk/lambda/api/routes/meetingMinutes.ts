import { Router } from 'express';
import { handler as minutesCustomPromptHandler } from '../../meetingMinutes/minutesCustomPrompt';
import { route } from '../../utils/http';

export const router = Router();

router.get('/custom-prompts', route(minutesCustomPromptHandler));
router.post('/custom-prompts', route(minutesCustomPromptHandler));
router.put('/custom-prompts/:id', route(minutesCustomPromptHandler));
router.delete('/custom-prompts/:id', route(minutesCustomPromptHandler));
