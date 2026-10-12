import { Prisma } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { publishBalance } from '../operator-balances/balance-events';
import { operatorRepository } from '../operators/operator.repository';
import { resourceAllocationRepository as repo } from './resource-allocation.repository';
import {
  CreateResourceAllocationDto,
  ListResourceAllocationsQuery,
} from './resource-allocation.schema';

export const resourceAllocationService = {
  list: (q: ListResourceAllocationsQuery) => repo.findAll(q),

  async get(id: bigint) {
    const allocation = await repo.findById(id);
    if (!allocation) throw AppError.notFound('Resource allocation');
    return allocation;
  },

  /** Returns `created: false` when the idempotency key was already used (the original row is returned). */
  async create(dto: CreateResourceAllocationDto) {
    if (dto.idempotencyKey) {
      const replay = await repo.findByIdempotencyKey(dto.idempotencyKey);
      if (replay) return { allocation: replay, created: false };
    }

    const operator = await operatorRepository.findById(dto.operatorId);
    if (!operator) throw AppError.notFound('Operator');
    if (!operator.isActive) throw AppError.conflict('Operator is not active');
    if (dto.createdBy && !(await operatorRepository.findById(dto.createdBy))) {
      throw AppError.notFound('Creating operator (createdBy)');
    }
    if (dto.allocationType && dto.allocationType !== 'NORMAL') {
      throw AppError.badRequest(
        'Only NORMAL allocations can be created here; adjustments and expirations are system-generated',
      );
    }

    try {
      const allocation = await repo.createWithBalance({
        operatorId: dto.operatorId,
        unitsDelta: dto.unitsDelta,
        allocationType: 'NORMAL',
        effectiveAt: dto.effectiveAt,
        // expires_at comes from the operator's tier (see repository); a client value is only
        // kept for debits, which never expire.
        expiresAt: undefined,
        tierId: operator.tierId, // tier in force at creation time
        createdBy: dto.createdBy,
        idempotencyKey: dto.idempotencyKey,
      });
      await publishBalance(allocation.operatorId);
      return { allocation, created: true };
    } catch (e) {
      // Two concurrent requests with the same key: the loser replays the winner's row.
      if (dto.idempotencyKey && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const replay = await repo.findByIdempotencyKey(dto.idempotencyKey);
        if (replay) return { allocation: replay, created: false };
      }
      throw e;
    }
  },

  async void(id: bigint, actorId: bigint | null) {
    const allocation = await repo.voidWithBalance(id, actorId);
    await publishBalance(allocation.operatorId);
    return allocation;
  },
};

export type { ListResourceAllocationsQuery };
