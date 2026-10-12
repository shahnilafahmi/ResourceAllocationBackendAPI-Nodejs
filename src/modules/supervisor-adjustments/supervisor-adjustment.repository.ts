import { Prisma } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { prisma } from '../../database/prisma';
import { adjustmentKey, expireDue, lockBalance, settle } from '../operator-balances/balance-engine';
import {
  CreateSupervisorAdjustmentDto,
  ListSupervisorAdjustmentsQuery,
  UpdateRecalculationStatusDto,
} from './supervisor-adjustment.schema';

export const supervisorAdjustmentRepository = {
  findAll: (q: ListSupervisorAdjustmentsQuery) =>
    prisma.supervisorAdjustment.findMany({
      where: {
        operatorId: q.operatorId,
        supervisorId: q.supervisorId,
        allocationId: q.allocationId,
        recalculationStatus: q.recalculationStatus,
      },
      orderBy: { id: 'desc' },
      take: q.limit,
      skip: q.offset,
    }),
  findById: (id: bigint) => prisma.supervisorAdjustment.findUnique({ where: { id } }),

  /**
   * Records the adjustment, writes it into the ledger at its (possibly retroactive) effective time
   * and recalculates the operator's balance and status level - all in one transaction under the
   * operator's balance lock. If the corrected history would leave the balance negative the whole
   * thing is rolled back with a 409.
   *
   * A credit adjustment inherits the original allocation's expires_at, so it expires with it.
   */
  createAndRecalculate: (dto: CreateSupervisorAdjustmentDto) =>
    prisma.$transaction(async (tx) => {
      await lockBalance(tx, dto.operatorId);
      await expireDue(tx, dto.operatorId);

      const original = await tx.resourceAllocation.findUniqueOrThrow({ where: { id: dto.allocationId } });
      if (original.isVoided) throw AppError.conflict('Cannot adjust a voided allocation');

      const adjustment = await tx.supervisorAdjustment.create({
        data: { ...dto, recalculationStatus: 'PROCESSING' },
      });
      const isCredit = new Prisma.Decimal(dto.adjustmentDelta).gt(0);
      await tx.resourceAllocation.create({
        data: {
          operatorId: dto.operatorId,
          unitsDelta: dto.adjustmentDelta,
          allocationType: 'SUPERVISOR_ADJUSTMENT',
          effectiveAt: dto.effectiveAt,
          expiresAt: isCredit ? original.expiresAt : null,
          tierId: original.tierId,
          createdBy: dto.supervisorId,
          idempotencyKey: adjustmentKey(adjustment.id),
        },
      });

      const change = await settle(tx, dto.operatorId);

      const completed = await tx.supervisorAdjustment.update({
        where: { id: adjustment.id },
        data: { recalculationStatus: 'COMPLETED', recalculatedAt: new Date() },
      });
      await tx.activityLog.create({
        data: {
          operatorId: dto.operatorId,
          actorId: dto.supervisorId,
          allocationId: dto.allocationId,
          adjustmentId: adjustment.id,
          actionType: 'ADJUSTMENT_APPLIED',
          description: dto.reason,
          metadata: {
            adjustmentDelta: completed.adjustmentDelta.toString(),
            effectiveAt: completed.effectiveAt.toISOString(),
            previousUnits: change.previousUnits.toString(),
            currentUnits: change.currentUnits.toString(),
            previousStatusLevelId: change.previousStatusLevelId?.toString() ?? null,
            currentStatusLevelId: change.currentStatusLevelId?.toString() ?? null,
          },
        },
      });
      return completed;
    }),

  updateRecalculationStatus: (id: bigint, dto: UpdateRecalculationStatusDto) =>
    prisma.supervisorAdjustment.update({
      where: { id },
      data: { recalculationStatus: dto.recalculationStatus, recalculatedAt: dto.recalculatedAt },
    }),
};
