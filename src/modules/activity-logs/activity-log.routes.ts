import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler';
import { validate } from '../../common/middlewares/validate';
import { bigIntIdParamSchema } from '../../common/schemas';
import { activityLogController as c } from './activity-log.controller';
import { createActivityLogSchema, listActivityLogsQuerySchema } from './activity-log.schema';

export const activityLogRoutes = Router();

// Append-only: no update or delete endpoints.
activityLogRoutes.get('/', validate(listActivityLogsQuerySchema, 'query'), asyncHandler(c.list));
activityLogRoutes.get('/:id', validate(bigIntIdParamSchema, 'params'), asyncHandler(c.get));
activityLogRoutes.post('/', validate(createActivityLogSchema), asyncHandler(c.create));
