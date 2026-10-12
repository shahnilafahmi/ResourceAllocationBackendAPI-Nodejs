import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { CreateActivityLogDto, ListActivityLogsQuery } from './activity-log.schema';

export const activityLogRepository = {
  findAll: (q: ListActivityLogsQuery) =>
    prisma.activityLog.findMany({
      where: {
        operatorId: q.operatorId,
        actorId: q.actorId,
        allocationId: q.allocationId,
        adjustmentId: q.adjustmentId,
        actionType: q.actionType,
        createdAt: { gte: q.from, lte: q.to },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit,
      skip: q.offset,
    }),
  findById: (id: bigint) => prisma.activityLog.findUnique({ where: { id } }),
  create: (dto: CreateActivityLogDto) =>
    prisma.activityLog.create({ data: { ...dto, metadata: dto.metadata as Prisma.InputJsonObject | undefined } }),
};
