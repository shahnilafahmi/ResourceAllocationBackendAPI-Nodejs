import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler';
import { validate } from '../../common/middlewares/validate';
import { bigIntIdParamSchema } from '../../common/schemas';
import { operatorTierController as c } from './operator-tier.controller';
import {
  createOperatorTierSchema,
  listOperatorTiersQuerySchema,
  updateOperatorTierSchema,
} from './operator-tier.schema';

export const operatorTierRoutes = Router();

operatorTierRoutes.get('/', validate(listOperatorTiersQuerySchema, 'query'), asyncHandler(c.list));
operatorTierRoutes.get('/:id', validate(bigIntIdParamSchema, 'params'), asyncHandler(c.get));
operatorTierRoutes.post('/', validate(createOperatorTierSchema), asyncHandler(c.create));
operatorTierRoutes.patch(
  '/:id',
  validate(bigIntIdParamSchema, 'params'),
  validate(updateOperatorTierSchema),
  asyncHandler(c.update),
);
