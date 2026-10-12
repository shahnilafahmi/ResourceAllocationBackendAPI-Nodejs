import { z } from 'zod';
import {
  atLeastOneField,
  atLeastOneFieldMessage,
  nonNegativeDecimalSchema,
  paginationQuerySchema,
} from '../../common/schemas';

const baseStatusLevelSchema = z.object({
  statusName: z.string().trim().min(1).max(50),
  minUnits: nonNegativeDecimalSchema, // CHECK min_units >= 0
  maxUnits: nonNegativeDecimalSchema.nullable(), // NULL = no upper bound
  priority: z.number().int().min(-2147483648).max(2147483647),
});

// CHECK max_units IS NULL OR max_units >= min_units
const maxNotBelowMin = (s: { minUnits?: string; maxUnits?: string | null }) =>
  s.minUnits === undefined || s.maxUnits == null || Number(s.maxUnits) >= Number(s.minUnits);
const maxNotBelowMinMessage = { message: 'maxUnits must be >= minUnits', path: ['maxUnits'] };

export const createStatusLevelSchema = baseStatusLevelSchema
  .partial({ maxUnits: true, priority: true })
  .refine(maxNotBelowMin, maxNotBelowMinMessage);

/**
 * The min/max check only runs when both fields are in the body; the service must
 * re-check against the stored row when only one of them is being changed.
 */
export const updateStatusLevelSchema = baseStatusLevelSchema
  .partial()
  .refine(atLeastOneField, atLeastOneFieldMessage)
  .refine(maxNotBelowMin, maxNotBelowMinMessage);

export const listStatusLevelsQuerySchema = paginationQuerySchema;

export type CreateStatusLevelDto = z.infer<typeof createStatusLevelSchema>;
export type UpdateStatusLevelDto = z.infer<typeof updateStatusLevelSchema>;
