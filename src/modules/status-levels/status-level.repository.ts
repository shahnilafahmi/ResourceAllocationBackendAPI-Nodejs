import { Prisma, StatusLevel } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { CreateStatusLevelDto, UpdateStatusLevelDto } from './status-level.schema';

/** Public (API) shape: the model's `name` field is exposed as `statusName`, as in the DTOs. */
export const toStatusLevelResponse = ({ name, ...rest }: StatusLevel) => ({ ...rest, statusName: name });

const toData = (dto: UpdateStatusLevelDto): Prisma.StatusLevelUpdateInput => ({
  name: dto.statusName,
  minUnits: dto.minUnits,
  maxUnits: dto.maxUnits,
  priority: dto.priority,
});

export const statusLevelRepository = {
  findAll: (limit: number, offset: number) =>
    prisma.statusLevel.findMany({ orderBy: { minUnits: 'asc' }, take: limit, skip: offset }),
  findById: (id: bigint) => prisma.statusLevel.findUnique({ where: { id } }),
  create: (dto: CreateStatusLevelDto) =>
    prisma.statusLevel.create({
      data: {
        name: dto.statusName,
        minUnits: dto.minUnits,
        maxUnits: dto.maxUnits,
        priority: dto.priority,
      },
    }),
  update: (id: bigint, dto: UpdateStatusLevelDto) =>
    prisma.statusLevel.update({ where: { id }, data: toData(dto) }),
  delete: (id: bigint) => prisma.statusLevel.delete({ where: { id } }),
};
