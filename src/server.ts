import { app } from './app';
import { env } from './config/env';
import { prisma } from './database/prisma';
import { startExpirationJob } from './jobs/expiration.job';

const server = app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}/api (${env.nodeEnv})`);
});

const stopExpirationJob =
  env.expirationJobIntervalMs > 0 ? startExpirationJob(env.expirationJobIntervalMs) : () => {};

const shutdown = async () => {
  stopExpirationJob();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
