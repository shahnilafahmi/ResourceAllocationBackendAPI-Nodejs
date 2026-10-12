import { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../errors/app-error';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
};

/** Maps a Postgres SQLSTATE (from Prisma errors or raw queries) to an HTTP response. */
const fromSqlState = (state?: string): { status: number; message: string } | undefined => {
  if (state === '23505') return { status: 409, message: 'Unique constraint violated' };
  if (state === '23503') return { status: 409, message: 'Foreign key constraint violated' };
  if (state === '23514') return { status: 400, message: 'A database check constraint was violated' };
  if (state?.startsWith('22')) return { status: 400, message: 'Invalid data value' };
  return undefined;
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message, details: err.details });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'Unique constraint violated' });
    if (err.code === 'P2025') return res.status(404).json({ message: 'Record not found' });
    if (err.code === 'P2003') return res.status(409).json({ message: 'Foreign key constraint violated' });
    if (err.code === 'P2010') {
      const mapped = fromSqlState((err.meta as { code?: string } | undefined)?.code);
      if (mapped) return res.status(mapped.status).json({ message: mapped.message });
    }
  }
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
};
