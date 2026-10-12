import { RequestHandler } from 'express';
import { ZodTypeAny } from 'zod';
import { AppError } from '../errors/app-error';

type Source = 'body' | 'query' | 'params';

/** Validates req[source] with a zod schema and replaces it with the parsed value. */
export const validate =
  (schema: ZodTypeAny, source: Source = 'body'): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(AppError.badRequest('Validation failed', result.error.flatten()));
    }
    if (source === 'body') req.body = result.data;
    else Object.defineProperty(req, source, { value: result.data, writable: true });
    next();
  };
