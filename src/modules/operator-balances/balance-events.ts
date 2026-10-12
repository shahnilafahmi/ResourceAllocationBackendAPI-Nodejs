import { EventEmitter } from 'node:events';
import { prisma } from '../../database/prisma';

export interface BalanceSnapshot {
  operatorId: bigint;
  currentUnits: string;
  statusLevelId: bigint | null;
  statusName: string | null;
  version: bigint;
  updatedAt: Date;
}

/**
 * In-process pub/sub used by the SSE stream. It only reaches clients connected to this Node
 * process; running several instances needs Postgres LISTEN/NOTIFY or Redis behind `publishBalance`.
 */
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

export async function readSnapshot(operatorId: bigint): Promise<BalanceSnapshot | null> {
  const b = await prisma.operatorBalance.findUnique({
    where: { operatorId },
    include: { statusLevel: { select: { name: true } } },
  });
  if (!b) return null;
  return {
    operatorId,
    currentUnits: b.currentUnits.toString(),
    statusLevelId: b.currentStatusLevelId,
    statusName: b.statusLevel?.name ?? null,
    version: b.version,
    updatedAt: b.updatedAt,
  };
}

/** Call after the transaction that changed the balance has committed. Never throws. */
export async function publishBalance(operatorId: bigint): Promise<void> {
  try {
    const snapshot = await readSnapshot(operatorId);
    if (snapshot) emitter.emit(operatorId.toString(), snapshot);
  } catch (err) {
    console.error(`Failed to publish balance for operator ${operatorId}`, err);
  }
}

export function subscribeBalance(operatorId: bigint, listener: (s: BalanceSnapshot) => void): () => void {
  const channel = operatorId.toString();
  emitter.on(channel, listener);
  return () => emitter.off(channel, listener);
}
