import { Request } from 'express';

/** Reads a path param already validated into a bigint by the validate middleware. */
export const bigIntParam = (req: Request, key = 'id'): bigint => BigInt(req.params[key] as string | bigint);

/** Reads req.query after the validate middleware replaced it with the parsed, typed value. */
export const parsedQuery = <T>(req: Request): T => req.query as unknown as T;
