import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler';
import { validate } from '../../common/middlewares/validate';
import { bigIntIdParamSchema } from '../../common/schemas';
import { operatorController as c } from './operator.controller';
import { createOperatorSchema, listOperatorsQuerySchema, updateOperatorSchema } from './operator.schema';

export const operatorRoutes = Router();

operatorRoutes.get('/', validate(listOperatorsQuerySchema, 'query'), asyncHandler(c.list));
operatorRoutes.get('/:id', validate(bigIntIdParamSchema, 'params'), asyncHandler(c.get));
operatorRoutes.post('/', validate(createOperatorSchema), asyncHandler(c.create));
operatorRoutes.patch(
  '/:id',
  validate(bigIntIdParamSchema, 'params'),
  validate(updateOperatorSchema),
  asyncHandler(c.update),
);
