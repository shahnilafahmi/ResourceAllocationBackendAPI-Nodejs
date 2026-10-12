import { prisma } from '../database/prisma';
import { publishBalance } from '../modules/operator-balances/balance-events';
import { dueForExpiration, lockBalance, settle } from '../modules/operator-balances/balance-engine';

/**
 * Expires due allocations for every operator that has some. Reads also expire lazily, so this
 * only keeps stored balances and status levels fresh for operators nobody is looking at.
 */
export async function runExpirationSweep(now = new Date()): Promise<number> {
  const rows = await prisma.resourceAllocation.findMany({
    where: dueForExpiration(now),
    distinct: ['operatorId'],
    select: { operatorId: true },
  });

  let processed = 0;
  for (const { operatorId } of rows) {
    try {
      await prisma.$transaction(async (tx) => {
        await lockBalance(tx, operatorId);
        await settle(tx, operatorId);
      });
      await publishBalance(operatorId);
      processed += 1;
    } catch (err) {
      console.error(`Expiration sweep failed for operator ${operatorId}`, err);
    }
  }
  return processed;
}

export function startExpirationJob(intervalMs: number): () => void {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return; // never overlap sweeps
    running = true;
    try {
      await runExpirationSweep();
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
