import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';

export type Tx = Prisma.TransactionClient;

/**
 * Balance rules
 * -------------
 * The ledger (resource_allocations, non-voided rows) is the source of truth. operator_balances is a
 * cache derived from it by `recomputeBalance`, so any mutation - new allocation, void, expiration,
 * retroactive supervisor adjustment - goes through the same path and can never drift.
 *
 * Every mutation for one operator runs in a transaction that first takes a row lock on the balance
 * (`lockBalance`). Concurrent writers for the same operator are therefore serialised instead of
 * failing, and each one sees the previous writer's committed rows.
 *
 * Expiration: a positive allocation whose expires_at has passed is expired once. The expired amount is
 * min(units, current balance) - i.e. units spent in the meantime are treated as having consumed the
 * soonest-to-expire units first - written as an EXPIRATION ledger row with a deterministic
 * idempotency key, and an ALLOCATION_EXPIRED activity log row marks the allocation as handled.
 */

/** Deterministic (v5-style) UUID so a derived ledger row can only ever be written once. */
export function deterministicUuid(name: string): string {
  const h = createHash('sha1').update(name).digest();
  h[6] = (h[6]! & 0x0f) | 0x50;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

export const expirationKey = (allocationId: bigint) => deterministicUuid(`expire:${allocationId}`);
export const adjustmentKey = (adjustmentId: bigint) => deterministicUuid(`adjust:${adjustmentId}`);

/** Ensures the balance row exists and takes a row lock on it until the transaction ends. */
export async function lockBalance(tx: Tx, operatorId: bigint): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO operator_balances (operator_id) VALUES (${operatorId})
    ON CONFLICT (operator_id) DO NOTHING`;
  await tx.$queryRaw`SELECT operator_id FROM operator_balances WHERE operator_id = ${operatorId} FOR UPDATE`;
}

async function ledgerTotal(tx: Tx, operatorId: bigint): Promise<Prisma.Decimal> {
  const { _sum } = await tx.resourceAllocation.aggregate({
    where: { operatorId, isVoided: false },
    _sum: { unitsDelta: true },
  });
  return _sum.unitsDelta ?? new Prisma.Decimal(0);
}

/** Allocations that have passed expires_at and have not been expired yet. */
export const dueForExpiration = (now: Date): Prisma.ResourceAllocationWhereInput => ({
  isVoided: false,
  unitsDelta: { gt: 0 },
  allocationType: { not: 'EXPIRATION' },
  expiresAt: { lte: now },
  activityLogs: { none: { actionType: 'ALLOCATION_EXPIRED' } },
});

/** Expires every due allocation of the operator. Caller must hold the balance lock. */
export async function expireDue(tx: Tx, operatorId: bigint, now = new Date()): Promise<number> {
  const due = await tx.resourceAllocation.findMany({
    where: { operatorId, ...dueForExpiration(now) },
    orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
  });
  if (due.length === 0) return 0;

  let available = await ledgerTotal(tx, operatorId);
  for (const lot of due) {
    const amount = Prisma.Decimal.min(lot.unitsDelta, available.isNegative() ? new Prisma.Decimal(0) : available);
    if (amount.gt(0)) {
      await tx.resourceAllocation.create({
        data: {
          operatorId,
          unitsDelta: amount.negated(),
          allocationType: 'EXPIRATION',
          effectiveAt: lot.expiresAt!,
          tierId: lot.tierId,
          idempotencyKey: expirationKey(lot.id),
        },
      });
      available = available.sub(amount);
    }
    await tx.activityLog.create({
      data: {
        operatorId,
        allocationId: lot.id,
        actionType: 'ALLOCATION_EXPIRED',
        metadata: { originalUnits: lot.unitsDelta.toString(), expiredUnits: amount.toString() },
      },
    });
  }
  return due.length;
}

export interface BalanceChange {
  previousUnits: Prisma.Decimal;
  currentUnits: Prisma.Decimal;
  previousStatusLevelId: bigint | null;
  currentStatusLevelId: bigint | null;
}

/**
 * Re-derives units and status level from the ledger and stores them. Throws a 409 (rolling the
 * transaction back) if the result would be negative. Caller must hold the balance lock.
 */
export async function recomputeBalance(tx: Tx, operatorId: bigint): Promise<BalanceChange> {
  const previous = await tx.operatorBalance.findUniqueOrThrow({ where: { operatorId } });
  const total = await ledgerTotal(tx, operatorId);
  if (total.isNegative()) {
    throw AppError.conflict(
      `Insufficient units: this change would bring the balance to ${total.toString()} (must stay >= 0)`,
    );
  }

  const level = await tx.statusLevel.findFirst({
    where: { minUnits: { lte: total }, OR: [{ maxUnits: null }, { maxUnits: { gte: total } }] },
    orderBy: [{ minUnits: 'desc' }, { priority: 'desc' }],
  });

  await tx.operatorBalance.update({
    where: { operatorId },
    data: {
      currentUnits: total,
      currentStatusLevelId: level?.id ?? null,
      version: { increment: 1 },
      updatedAt: new Date(),
    },
  });

  return {
    previousUnits: previous.currentUnits,
    currentUnits: total,
    previousStatusLevelId: previous.currentStatusLevelId,
    currentStatusLevelId: level?.id ?? null,
  };
}

/** Expire anything due, then re-derive the balance. Use after the ledger was changed. */
export async function settle(tx: Tx, operatorId: bigint): Promise<BalanceChange> {
  await expireDue(tx, operatorId);
  return recomputeBalance(tx, operatorId);
}

/** Runs `fn` under the operator's balance lock, with due expirations applied first. */
export async function withOperatorLock<T>(
  tx: Tx,
  operatorId: bigint,
  fn: () => Promise<T>,
): Promise<T> {
  await lockBalance(tx, operatorId);
  await expireDue(tx, operatorId);
  return fn();
}

/** expires_at for a new allocation: effective_at + the tier's window; a zero window never expires. */
export async function expiryFromTier(tx: Tx, tierId: bigint, effectiveAt: Date): Promise<Date | null> {
  const rows = await tx.$queryRaw<{ expires_at: Date | null }[]>`
    SELECT CASE WHEN expiration_window = INTERVAL '0 seconds' THEN NULL
                ELSE ${effectiveAt}::timestamptz + expiration_window END AS expires_at
    FROM operator_tiers WHERE tier_id = ${tierId}`;
  return rows[0]?.expires_at ?? null;
}
