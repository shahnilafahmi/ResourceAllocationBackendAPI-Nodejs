import { z } from 'zod';
import { bigIntIdSchema, paginationQuerySchema, timestampSchema } from '../../common/schemas';

/** Activity logs are append-only: create and list only. */
export const createActivityLogSchema = z.object({
  operatorId: bigIntIdSchema,
  actorId: bigIntIdSchema.nullable().optional(),
  allocationId: bigIntIdSchema.nullable().optional(),
  adjustmentId: bigIntIdSchema.nullable().optional(),
  actionType: z.string().trim().min(1).max(50),
  description: z.string().trim().max(2000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(), // DB default {}
});

export const listActivityLogsQuerySchema = paginationQuerySchema.extend({
  operatorId: bigIntIdSchema.optional(),
  actorId: bigIntIdSchema.optional(),
  allocationId: bigIntIdSchema.optional(),
  adjustmentId: bigIntIdSchema.optional(),
  actionType: z.string().trim().min(1).max(50).optional(),
  from: timestampSchema.optional(),
  to: timestampSchema.optional(),
});

export type CreateActivityLogDto = z.infer<typeof createActivityLogSchema>;
export type ListActivityLogsQuery = z.infer<typeof listActivityLogsQuerySchema>;
