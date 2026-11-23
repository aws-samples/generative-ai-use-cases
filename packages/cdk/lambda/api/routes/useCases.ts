import { Router } from 'express';
import { handler as listUseCasesHandler } from '../../useCaseBuilder/listUseCases';
import { handler as listFavoriteUseCasesHandler } from '../../useCaseBuilder/listFavoriteUseCases';
import { handler as getUseCaseHandler } from '../../useCaseBuilder/getUseCase';
import { handler as createUseCaseHandler } from '../../useCaseBuilder/createUseCase';
import { handler as updateUseCaseHandler } from '../../useCaseBuilder/updateUseCase';
import { handler as deleteUseCaseHandler } from '../../useCaseBuilder/deleteUseCase';
import { handler as toggleFavoriteHandler } from '../../useCaseBuilder/toggleFavorite';
import { handler as toggleSharedHandler } from '../../useCaseBuilder/toggleShared';
import { handler as listRecentlyUsedUseCasesHandler } from '../../useCaseBuilder/listRecentlyUsedUseCases';
import { handler as updateRecentlyUsedUseCaseHandler } from '../../useCaseBuilder/updateRecentlyUsedUseCase';
import { route } from '../../utils/http';

export const router = Router();

router.get('/', route(listUseCasesHandler));
router.get('/favorite', route(listFavoriteUseCasesHandler));
router.get('/recent', route(listRecentlyUsedUseCasesHandler));
router.put('/recent/:useCaseId', route(updateRecentlyUsedUseCaseHandler));
router.get('/:useCaseId', route(getUseCaseHandler));
router.post('/', route(createUseCaseHandler));
router.put('/:useCaseId', route(updateUseCaseHandler));
router.delete('/:useCaseId', route(deleteUseCaseHandler));
router.put('/:useCaseId/favorite', route(toggleFavoriteHandler));
router.put('/:useCaseId/shared', route(toggleSharedHandler));
