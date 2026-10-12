import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/utils/async-handler';
import { validate } from '../../common/middlewares/validate';
import { bigIntIdParamSchema, bigIntIdSchema } from '../../common/schemas';
import { resourceAllocationController as c } from './resource-allocation.controller';
import {
  createResourceAllocationSchema,
  listResourceAllocationsQuerySchema,
} from './resource-allocation.schema';

export const resourceAllocationRoutes = Router();

const voidBodySchema = z.object({ actorId: bigIntIdSchema.optional() }).default({});

resourceAllocationRoutes.get('/', validate(listResourceAllocationsQuerySchema, 'query'), asyncHandler(c.list));
resourceAllocationRoutes.get('/:id', validate(bigIntIdParamSchema, 'params'), asyncHandler(c.get));
resourceAllocationRoutes.post('/', validate(createResourceAllocationSchema), asyncHandler(c.create));
// The ledger is append-only: corrections are made by voiding, never by editing or deleting.
resourceAllocationRoutes.post(
  '/:id/void',
  validate(bigIntIdParamSchema, 'params'),
  validate(voidBodySchema),
  asyncHandler(c.void),
);
