import { Prisma } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { statusLevelRepository, toStatusLevelResponse } from './status-level.repository';
import { CreateStatusLevelDto, UpdateStatusLevelDto } from './status-level.schema';

export const statusLevelService = {
  async list(limit: number, offset: number) {
    const levels = await statusLevelRepository.findAll(limit, offset);
    return levels.map(toStatusLevelResponse);
  },

  async get(id: bigint) {
    const level = await statusLevelRepository.findById(id);
    if (!level) throw AppError.notFound('Status level');
    return toStatusLevelResponse(level);
  },

  async create(dto: CreateStatusLevelDto) {
    return toStatusLevelResponse(await statusLevelRepository.create(dto));
  },

  async update(id: bigint, dto: UpdateStatusLevelDto) {
    const existing = await statusLevelRepository.findById(id);
    if (!existing) throw AppError.notFound('Status level');

    // The schema only checks max >= min when both are sent; re-check against the stored row.
    const min = new Prisma.Decimal(dto.minUnits ?? existing.minUnits);
    const maxRaw = dto.maxUnits === undefined ? existing.maxUnits : dto.maxUnits;
    if (maxRaw !== null && new Prisma.Decimal(maxRaw).lt(min)) {
      throw AppError.badRequest('maxUnits must be >= minUnits');
    }
    return toStatusLevelResponse(await statusLevelRepository.update(id, dto));
  },

  async remove(id: bigint) {
    await this.get(id);
    await statusLevelRepository.delete(id);
  },
};
