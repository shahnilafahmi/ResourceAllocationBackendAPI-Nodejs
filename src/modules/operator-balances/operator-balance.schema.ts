import { z } from 'zod';
import {
  atLeastOneField,
  atLeastOneFieldMessage,
  bigIntIdSchema,
  nonNegativeDecimalSchema,
  paginationQuerySchema,
} from '../../common/schemas';

export const createOperatorBalanceSchema = z.object({
  operatorId: bigIntIdSchema,
  currentUnits: nonNegativeDecimalSchema.optional(), // CHECK current_units >= 0
  currentStatusLevelId: bigIntIdSchema.nullable().optional(),
});

/** `version` is the optimistic-locking token: the caller must send the version it read. */
export const updateOperatorBalanceSchema = z
  .object({
    currentUnits: nonNegativeDecimalSchema.optional(),
    currentStatusLevelId: bigIntIdSchema.nullable().optional(),
    version: z.number().int().min(0), // CHECK version >= 0
  })
  .refine((b) => b.currentUnits !== undefined || b.currentStatusLevelId !== undefined, {
    message: 'At least one of currentUnits or currentStatusLevelId must be provided',
  });

export const operatorIdParamSchema = z.object({ operatorId: bigIntIdSchema });

export const listOperatorBalancesQuerySchema = paginationQuerySchema.extend({
  currentStatusLevelId: bigIntIdSchema.optional(),
});

export type CreateOperatorBalanceDto = z.infer<typeof createOperatorBalanceSchema>;
export type UpdateOperatorBalanceDto = z.infer<typeof updateOperatorBalanceSchema>;
