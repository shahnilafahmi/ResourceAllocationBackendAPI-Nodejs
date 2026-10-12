import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './common/middlewares/error-handler';
import { env } from './config/env';
import { apiRouter } from './routes';

// BIGINT columns come back as bigint, which JSON.stringify cannot serialise. Emit them as strings
// (they can exceed Number.MAX_SAFE_INTEGER).
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (this: bigint) {
  return this.toString();
};

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Last-Event-ID'],
    maxAge: 600,
  }),
);
app.use(express.json());

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
