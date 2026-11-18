import { Router } from 'express';
import { handler as generateImageHandler } from '../../generateImage';
import { route } from '../../utils/http';

export const router = Router();

router.post('/generate', route(generateImageHandler));
