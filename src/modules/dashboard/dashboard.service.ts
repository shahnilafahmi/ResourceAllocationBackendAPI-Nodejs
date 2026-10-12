import { Prisma } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { prisma } from '../../database/prisma';
import { publishBalance } from '../operator-balances/balance-events';
import { dueForExpiration, lockBalance, settle } from '../operator-balances/balance-engine';

interface TimelineRow {
  allocation_id: bigint;
  allocation_type: string;
  units_delta: string;
  running_units: string;
  effective_at: Date;
  expires_at: Date | null;
  created_at: Date;
  status_level_id: bigint | null;
  status_name: string | null;
}

export const dashboardService = {
  /**
   * The operator's live metric. Anything that expired since the last write is applied first, under
   * the balance lock, so the total never includes units that are no longer valid.
   */
  async get(operatorId: bigint) {
    const operator = await prisma.operator.findUnique({
      where: { id: operatorId },
      include: { tier: { select: { id: true, tierName: true } } },
    });
    if (!operator) throw AppError.notFound('Operator');

    const now = new Date();
    const hasDue = await prisma.resourceAllocation.count({ where: { operatorId, ...dueForExpiration(now) } });
    if (hasDue > 0) {
      await prisma.$transaction(async (tx) => {
        await lockBalance(tx, operatorId);
        await settle(tx, operatorId);
      });
      await publishBalance(operatorId);
    }

    const [balance, nextExpiring, recentActivity] = await Promise.all([
      prisma.operatorBalance.findUnique({
        where: { operatorId },
        include: { statusLevel: { select: { id: true, name: true, minUnits: true, maxUnits: true } } },
      }),
      prisma.resourceAllocation.findFirst({
        where: {
          operatorId,
          isVoided: false,
          unitsDelta: { gt: 0 },
          allocationType: { not: 'EXPIRATION' },
          expiresAt: { gt: now },
        },
        orderBy: { expiresAt: 'asc' },
        select: { id: true, unitsDelta: true, expiresAt: true },
      }),
      prisma.activityLog.findMany({
        where: { operatorId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 10,
      }),
    ]);

    return {
      operator: { id: operator.id, fullName: operator.fullName, tier: operator.tier },
      balance: {
        currentUnits: balance?.currentUnits ?? new Prisma.Decimal(0),
        statusLevel: balance?.statusLevel ?? null,
        version: balance?.version ?? 0n,
        updatedAt: balance?.updatedAt ?? null,
      },
      nextExpiry: nextExpiring
        ? { allocationId: nextExpiring.id, units: nextExpiring.unitsDelta, expiresAt: nextExpiring.expiresAt }
        : null,
      recentActivity,
      serverTime: now,
    };
  },

  /**
   * Ledger history with the running total and status level after every entry, in effective-time
   * order. Because it is computed from the ledger, a retroactive adjustment changes every later
   * row's running total and status here.
   */
  async timeline(operatorId: bigint, limit: number, offset: number) {
    if (!(await prisma.operator.findUnique({ where: { id: operatorId }, select: { id: true } }))) {
      throw AppError.notFound('Operator');
    }
    const rows = await prisma.$queryRaw<TimelineRow[]>`
      WITH ledger AS (
        SELECT allocation_id, allocation_type, units_delta, effective_at, expires_at, created_at,
               SUM(units_delta) OVER (ORDER BY effective_at, allocation_id) AS running_units
        FROM resource_allocations
        WHERE operator_id = ${operatorId} AND is_voided = FALSE
      )
      SELECT l.allocation_id, l.allocation_type, l.units_delta::text AS units_delta,
             l.running_units::text AS running_units, l.effective_at, l.expires_at, l.created_at,
             s.status_level_id, s.status_name
      FROM ledger l
      LEFT JOIN LATERAL (
        SELECT status_level_id, status_name FROM status_levels s
        WHERE s.min_units <= l.running_units AND (s.max_units IS NULL OR s.max_units >= l.running_units)
        ORDER BY s.min_units DESC, s.priority DESC
        LIMIT 1
      ) s ON TRUE
      ORDER BY l.effective_at DESC, l.allocation_id DESC
      LIMIT ${limit} OFFSET ${offset}`;

    return rows.map((r) => ({
      allocationId: r.allocation_id,
      allocationType: r.allocation_type,
      unitsDelta: r.units_delta,
      runningUnits: r.running_units,
      statusLevel: r.status_level_id ? { id: r.status_level_id, name: r.status_name } : null,
      effectiveAt: r.effective_at,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
    }));
  },
};
