import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/** Positive BIGINT id. Accepts a digit string or a safe integer; yields a bigint. */
export const bigIntIdSchema = z
  .union([z.string().regex(/^\d+$/, 'Must be a positive integer'), z.number().int()])
  .transform((v) => BigInt(v))
  .refine((v) => v > 0n && v <= 9223372036854775807n, 'Must be a positive 64-bit integer');

export const bigIntIdParamSchema = z.object({ id: bigIntIdSchema });

/** ISO-8601 timestamp with offset (e.g. 2026-10-12T09:00:00Z); yields a Date. */
export const timestampSchema = z.iso
  .datetime({ offset: true })
  .transform((s) => new Date(s));

const DECIMAL_14_2 = /^-?\d{1,12}(\.\d{1,2})?$/;

/** NUMERIC(14,2): up to 12 integer digits and 2 decimals. Yields a string (Prisma Decimal input). */
export const decimalSchema = z
  .union([z.number(), z.string()])
  .transform((v) => String(v).trim())
  .pipe(z.string().regex(DECIMAL_14_2, 'Must be a number with at most 12 integer digits and 2 decimal places'));

export const nonZeroDecimalSchema = decimalSchema.refine((v) => Number(v) !== 0, 'Must not be zero');

export const nonNegativeDecimalSchema = decimalSchema.refine((v) => Number(v) >= 0, 'Must be >= 0');

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Rejects empty PATCH bodies. */
export const atLeastOneField = <T extends object>(obj: T) => Object.keys(obj).length > 0;
export const atLeastOneFieldMessage = { message: 'At least one field must be provided' };
