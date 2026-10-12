import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  /** Browser origins allowed by CORS (comma-separated). Defaults to the Vite/React dev server. */
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  /** How often the expiration sweep runs; 0 disables it. */
  expirationJobIntervalMs: Number(process.env.EXPIRATION_JOB_INTERVAL_MS ?? 60_000),
};
