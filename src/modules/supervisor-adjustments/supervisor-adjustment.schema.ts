import { z } from 'zod';
import {
  bigIntIdSchema,
  nonZeroDecimalSchema,
  paginationQuerySchema,
  timestampSchema,
} from '../../common/schemas';

export const RECALCULATION_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] as const;

/** `recalculationStatus` starts as PENDING (DB default) and is never set by the caller. */
export const createSupervisorAdjustmentSchema = z.object({
  operatorId: bigIntIdSchema,
  allocationId: bigIntIdSchema,
  supervisorId: bigIntIdSchema,
  adjustmentDelta: nonZeroDecimalSchema, // CHECK adjustment_delta <> 0
  effectiveAt: timestampSchema,
  reason: z.string().trim().min(1).max(2000),
});

/** Used by the recalculation worker only; not exposed to end users. */
export const updateRecalculationStatusSchema = z
  .object({
    recalculationStatus: z.enum(RECALCULATION_STATUSES),
    recalculatedAt: timestampSchema.nullable().optional(),
  })
  .refine((a) => a.recalculationStatus !== 'COMPLETED' || a.recalculatedAt, {
    message: 'recalculatedAt is required when status is COMPLETED',
    path: ['recalculatedAt'],
  });

export const listSupervisorAdjustmentsQuerySchema = paginationQuerySchema.extend({
  operatorId: bigIntIdSchema.optional(),
  supervisorId: bigIntIdSchema.optional(),
  allocationId: bigIntIdSchema.optional(),
  recalculationStatus: z.enum(RECALCULATION_STATUSES).optional(),
});

export type CreateSupervisorAdjustmentDto = z.infer<typeof createSupervisorAdjustmentSchema>;
export type UpdateRecalculationStatusDto = z.infer<typeof updateRecalculationStatusSchema>;
export type ListSupervisorAdjustmentsQuery = z.infer<typeof listSupervisorAdjustmentsQuerySchema>;
