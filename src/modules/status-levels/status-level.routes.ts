import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler';
import { validate } from '../../common/middlewares/validate';
import { bigIntIdParamSchema } from '../../common/schemas';
import { statusLevelController as c } from './status-level.controller';
import {
  createStatusLevelSchema,
  listStatusLevelsQuerySchema,
  updateStatusLevelSchema,
} from './status-level.schema';

export const statusLevelRoutes = Router();

statusLevelRoutes.get('/', validate(listStatusLevelsQuerySchema, 'query'), asyncHandler(c.list));
statusLevelRoutes.get('/:id', validate(bigIntIdParamSchema, 'params'), asyncHandler(c.get));
statusLevelRoutes.post('/', validate(createStatusLevelSchema), asyncHandler(c.create));
statusLevelRoutes.patch(
  '/:id',
  validate(bigIntIdParamSchema, 'params'),
  validate(updateStatusLevelSchema),
  asyncHandler(c.update),
);
statusLevelRoutes.delete('/:id', validate(bigIntIdParamSchema, 'params'), asyncHandler(c.remove));
