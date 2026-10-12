import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler';
import { validate } from '../../common/middlewares/validate';
import { bigIntIdParamSchema } from '../../common/schemas';
import { supervisorAdjustmentController as c } from './supervisor-adjustment.controller';
import {
  createSupervisorAdjustmentSchema,
  listSupervisorAdjustmentsQuerySchema,
  updateRecalculationStatusSchema,
} from './supervisor-adjustment.schema';

export const supervisorAdjustmentRoutes = Router();

supervisorAdjustmentRoutes.get(
  '/',
  validate(listSupervisorAdjustmentsQuerySchema, 'query'),
  asyncHandler(c.list),
);
supervisorAdjustmentRoutes.get('/:id', validate(bigIntIdParamSchema, 'params'), asyncHandler(c.get));
supervisorAdjustmentRoutes.post('/', validate(createSupervisorAdjustmentSchema), asyncHandler(c.create));
supervisorAdjustmentRoutes.patch(
  '/:id/recalculation-status',
  validate(bigIntIdParamSchema, 'params'),
  validate(updateRecalculationStatusSchema),
  asyncHandler(c.updateRecalculationStatus),
);
