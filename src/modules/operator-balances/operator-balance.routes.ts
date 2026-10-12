import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler';
import { validate } from '../../common/middlewares/validate';
import { operatorBalanceController as c } from './operator-balance.controller';
import {
  createOperatorBalanceSchema,
  listOperatorBalancesQuerySchema,
  operatorIdParamSchema,
  updateOperatorBalanceSchema,
} from './operator-balance.schema';

export const operatorBalanceRoutes = Router();

operatorBalanceRoutes.get('/', validate(listOperatorBalancesQuerySchema, 'query'), asyncHandler(c.list));
operatorBalanceRoutes.get('/:operatorId', validate(operatorIdParamSchema, 'params'), asyncHandler(c.get));
operatorBalanceRoutes.post('/', validate(createOperatorBalanceSchema), asyncHandler(c.create));
operatorBalanceRoutes.patch(
  '/:operatorId',
  validate(operatorIdParamSchema, 'params'),
  validate(updateOperatorBalanceSchema),
  asyncHandler(c.update),
);
