import { prisma } from '../../database/prisma';
import { CreateOperatorDto, ListOperatorsQuery, UpdateOperatorDto } from './operator.schema';

export const operatorRepository = {
  findAll: (q: ListOperatorsQuery) =>
    prisma.operator.findMany({
      where: { tierId: q.tierId, isActive: q.isActive },
      orderBy: { id: 'asc' },
      take: q.limit,
      skip: q.offset,
    }),
  findById: (id: bigint) => prisma.operator.findUnique({ where: { id } }),
  /** Creates the operator together with its (empty) balance row. */
  create: (dto: CreateOperatorDto) =>
    prisma.operator.create({ data: { ...dto, balance: { create: {} } } }),
  update: (id: bigint, dto: UpdateOperatorDto) => prisma.operator.update({ where: { id }, data: dto }),
};
