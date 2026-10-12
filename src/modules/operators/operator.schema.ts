import { z } from 'zod';
import {
  atLeastOneField,
  atLeastOneFieldMessage,
  bigIntIdSchema,
  paginationQuerySchema,
} from '../../common/schemas';

const baseOperatorSchema = z.object({
  fullName: z.string().trim().min(1).max(150),
  email: z.email().max(255).toLowerCase().nullable(),
  tierId: bigIntIdSchema,
  isActive: z.boolean(),
});

export const createOperatorSchema = baseOperatorSchema.partial({ email: true, isActive: true });

export const updateOperatorSchema = baseOperatorSchema
  .partial()
  .refine(atLeastOneField, atLeastOneFieldMessage);

export const listOperatorsQuerySchema = paginationQuerySchema.extend({
  tierId: bigIntIdSchema.optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

export type CreateOperatorDto = z.infer<typeof createOperatorSchema>;
export type UpdateOperatorDto = z.infer<typeof updateOperatorSchema>;
export type ListOperatorsQuery = z.infer<typeof listOperatorsQuerySchema>;
