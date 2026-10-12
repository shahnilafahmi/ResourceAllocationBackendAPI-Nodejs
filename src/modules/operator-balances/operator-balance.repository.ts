import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { CreateOperatorBalanceDto, UpdateOperatorBalanceDto } from './operator-balance.schema';

export const operatorBalanceRepository = {
  findAll: (q: { currentStatusLevelId?: bigint; limit: number; offset: number }) =>
    prisma.operatorBalance.findMany({
      where: { currentStatusLevelId: q.currentStatusLevelId },
      orderBy: { operatorId: 'asc' },
      take: q.limit,
      skip: q.offset,
    }),
  findByOperatorId: (operatorId: bigint) => prisma.operatorBalance.findUnique({ where: { operatorId } }),
  create: (dto: CreateOperatorBalanceDto) => prisma.operatorBalance.create({ data: dto }),

  /** Optimistic lock: only writes when the stored version still equals the caller's version. */
  async updateIfVersion(operatorId: bigint, dto: UpdateOperatorBalanceDto) {
    const data: Prisma.OperatorBalanceUpdateManyMutationInput & { currentStatusLevelId?: bigint | null } = {
      currentUnits: dto.currentUnits,
      currentStatusLevelId: dto.currentStatusLevelId,
      version: { increment: 1 },
      updatedAt: new Date(),
    };
    const { count } = await prisma.operatorBalance.updateMany({
      where: { operatorId, version: BigInt(dto.version) },
      data,
    });
    return count;
  },
};
