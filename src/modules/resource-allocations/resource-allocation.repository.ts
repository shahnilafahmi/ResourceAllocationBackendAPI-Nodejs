import { Prisma } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { prisma } from '../../database/prisma';
import {
  adjustmentKey,
  expirationKey,
  expiryFromTier,
  lockBalance,
  expireDue,
  settle,
} from '../operator-balances/balance-engine';
import { ListResourceAllocationsQuery } from './resource-allocation.schema';

export const resourceAllocationRepository = {
  findAll: (q: ListResourceAllocationsQuery) =>
    prisma.resourceAllocation.findMany({
      where: {
        operatorId: q.operatorId,
        allocationType: q.allocationType,
        isVoided: q.includeVoided ? undefined : false,
        effectiveAt: { gte: q.from, lte: q.to },
      },
      orderBy: [{ effectiveAt: 'desc' }, { id: 'desc' }],
      take: q.limit,
      skip: q.offset,
    }),
  findById: (id: bigint) => prisma.resourceAllocation.findUnique({ where: { id } }),
  findByIdempotencyKey: (idempotencyKey: string) =>
    prisma.resourceAllocation.findUnique({ where: { idempotencyKey } }),

  /**
   * Inserts the ledger row, re-derives the balance and writes the audit log in one transaction,
   * serialised per operator by the balance row lock. A positive NORMAL allocation gets its
   * expires_at from the operator's tier.
   */
  createWithBalance: (data: Prisma.ResourceAllocationUncheckedCreateInput) =>
    prisma.$transaction(async (tx) => {
      const operatorId = BigInt(data.operatorId);
      await lockBalance(tx, operatorId);
      await expireDue(tx, operatorId);

      const effectiveAt = data.effectiveAt ? new Date(data.effectiveAt) : new Date();
      const isCredit = new Prisma.Decimal(data.unitsDelta as Prisma.Decimal.Value).gt(0);
      const derivesExpiry = isCredit && (data.allocationType ?? 'NORMAL') === 'NORMAL' && data.tierId != null;
      const expiresAt = derivesExpiry ? await expiryFromTier(tx, data.tierId as bigint, effectiveAt) : data.expiresAt;

      const allocation = await tx.resourceAllocation.create({ data: { ...data, effectiveAt, expiresAt } });
      const change = await settle(tx, allocation.operatorId);

      await tx.activityLog.create({
        data: {
          operatorId: allocation.operatorId,
          actorId: allocation.createdBy,
          allocationId: allocation.id,
          actionType: 'ALLOCATION_CREATED',
          metadata: {
            unitsDelta: allocation.unitsDelta.toString(),
            allocationType: allocation.allocationType,
            expiresAt: allocation.expiresAt?.toISOString() ?? null,
            balanceAfter: change.currentUnits.toString(),
          },
        },
      });
      return allocation;
    }),

  /**
   * Marks the row voided (and the EXPIRATION row it produced, if any) and re-derives the balance,
   * atomically. Rejected with 409 if the balance would go negative.
   */
  voidWithBalance: (id: bigint, actorId: bigint | null) =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.resourceAllocation.findUnique({ where: { id } });
      if (!existing) throw AppError.notFound('Resource allocation');

      await lockBalance(tx, existing.operatorId);
      // Re-read under the lock so two concurrent voids cannot both pass the check.
      const current = await tx.resourceAllocation.findUniqueOrThrow({ where: { id } });
      if (current.isVoided) throw AppError.conflict('Resource allocation is already voided');
      if (current.allocationType === 'EXPIRATION') {
        throw AppError.conflict('Expiration entries are system-generated and cannot be voided');
      }

      await expireDue(tx, current.operatorId);
      const voidedAt = new Date();
      const allocation = await tx.resourceAllocation.update({
        where: { id },
        data: { isVoided: true, voidedAt },
      });
      // Voiding an allocation reverses everything attached to it: the ledger rows written for its
      // supervisor adjustments, and the EXPIRATION rows produced by it or by those adjustments.
      const adjustments = await tx.supervisorAdjustment.findMany({
        where: { allocationId: id },
        select: { id: true },
      });
      const adjustmentRows = await tx.resourceAllocation.findMany({
        where: { idempotencyKey: { in: adjustments.map((a) => adjustmentKey(a.id)) } },
        select: { id: true },
      });
      const sourceIds = [id, ...adjustmentRows.map((r) => r.id)];
      await tx.resourceAllocation.updateMany({
        where: {
          isVoided: false,
          OR: [
            { id: { in: sourceIds } },
            { idempotencyKey: { in: sourceIds.map(expirationKey) } },
          ],
        },
        data: { isVoided: true, voidedAt },
      });
      const change = await settle(tx, allocation.operatorId);

      await tx.activityLog.create({
        data: {
          operatorId: allocation.operatorId,
          actorId,
          allocationId: allocation.id,
          actionType: 'ALLOCATION_VOIDED',
          metadata: { unitsDelta: allocation.unitsDelta.toString(), balanceAfter: change.currentUnits.toString() },
        },
      });
      return allocation;
    }),
};
