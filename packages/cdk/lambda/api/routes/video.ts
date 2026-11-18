import { Router } from 'express';
import { handler as generateVideoHandler } from '../../generateVideo';
import { handler as listVideoJobsHandler } from '../../listVideoJobs';
import { handler as deleteVideoJobHandler } from '../../deleteVideoJob';
import { route } from '../../utils/http';

export const router = Router();

router.post('/generate', route(generateVideoHandler));
router.get('/generate', route(listVideoJobsHandler));
router.delete('/generate/:createdDate', route(deleteVideoJobHandler));
