import { Router } from 'express';
import { handler as getSignedUrlHandler } from '../../getFileUploadSignedUrl';
import { handler as getFileDownloadSignedUrlHandler } from '../../getFileDownloadSignedUrl';
import { handler as deleteFileHandler } from '../../deleteFile';
import { route } from '../../utils/http';

export const router = Router();

router.post('/url', route(getSignedUrlHandler));
router.get('/url', route(getFileDownloadSignedUrlHandler));
router.delete('/:fileName', route(deleteFileHandler));
