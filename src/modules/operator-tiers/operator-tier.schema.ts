import { z } from 'zod';
import { atLeastOneField, atLeastOneFieldMessage, paginationQuerySchema } from '../../common/schemas';

const UNIT = '(?:second|minute|hour|day|week|month|year)s?';
// Non-negative Postgres interval: "30 days", "1 hour 30 minutes" or "HH:MM:SS".
const INTERVAL_RE = new RegExp(`^(?:\\d+\\s+${UNIT})(?:\\s+\\d+\\s+${UNIT})*$|^\\d+:[0-5]\\d:[0-5]\\d$`, 'i');

const baseOperatorTierSchema = z.object({
  tierName: z.string().trim().min(1).max(50),
  // CHECK expiration_window >= '0 seconds' -> negative intervals are not accepted.
  expirationWindow: z
    .string()
    .trim()
    .regex(INTERVAL_RE, 'Must be a non-negative interval such as "30 days" or "01:30:00"'),
  isActive: z.boolean(),
});

export const createOperatorTierSchema = baseOperatorTierSchema.partial({ isActive: true });

export const updateOperatorTierSchema = baseOperatorTierSchema
  .partial()
  .refine(atLeastOneField, atLeastOneFieldMessage);

export const listOperatorTiersQuerySchema = paginationQuerySchema.extend({
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

export type CreateOperatorTierDto = z.infer<typeof createOperatorTierSchema>;
export type UpdateOperatorTierDto = z.infer<typeof updateOperatorTierSchema>;
export type ListOperatorTiersQuery = z.infer<typeof listOperatorTiersQuerySchema>;
