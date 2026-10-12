import { z } from 'zod';
import {
  bigIntIdSchema,
  nonZeroDecimalSchema,
  paginationQuerySchema,
  timestampSchema,
} from '../../common/schemas';

export const ALLOCATION_TYPES = ['NORMAL', 'SUPERVISOR_ADJUSTMENT', 'EXPIRATION'] as const;

/**
 * Allocations are an append-only ledger: there is no update schema. Corrections
 * are made with a new row (or a supervisor adjustment) and mistakes are voided.
 * `isVoided`, `voidedAt` and `createdAt` are server-managed and never accepted.
 */
export const createResourceAllocationSchema = z
  .object({
    operatorId: bigIntIdSchema,
    unitsDelta: nonZeroDecimalSchema, // CHECK units_delta <> 0
    allocationType: z.enum(ALLOCATION_TYPES).optional(), // DB default NORMAL
    effectiveAt: timestampSchema.optional(), // DB default NOW()
    expiresAt: timestampSchema.nullable().optional(),
    tierId: bigIntIdSchema.nullable().optional(),
    createdBy: bigIntIdSchema.nullable().optional(),
    idempotencyKey: z.uuid().nullable().optional(),
  })
  .refine((a) => !a.expiresAt || !a.effectiveAt || a.expiresAt >= a.effectiveAt, {
    message: 'expiresAt must be on or after effectiveAt', // CHECK chk_allocation_expiration
    path: ['expiresAt'],
  });

export const listResourceAllocationsQuerySchema = paginationQuerySchema.extend({
  operatorId: bigIntIdSchema.optional(),
  allocationType: z.enum(ALLOCATION_TYPES).optional(),
  includeVoided: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  from: timestampSchema.optional(),
  to: timestampSchema.optional(),
});

export type CreateResourceAllocationDto = z.infer<typeof createResourceAllocationSchema>;
export type ListResourceAllocationsQuery = z.infer<typeof listResourceAllocationsQuerySchema>;
