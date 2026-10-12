import { AppError } from '../../common/errors/app-error';
import { operatorTierRepository } from './operator-tier.repository';
import {
  CreateOperatorTierDto,
  ListOperatorTiersQuery,
  UpdateOperatorTierDto,
} from './operator-tier.schema';

export const operatorTierService = {
  list: (q: ListOperatorTiersQuery) => operatorTierRepository.findAll(q),

  async get(id: bigint) {
    const tier = await operatorTierRepository.findById(id);
    if (!tier) throw AppError.notFound('Operator tier');
    return tier;
  },

  create: (dto: CreateOperatorTierDto) => operatorTierRepository.create(dto),

  async update(id: bigint, dto: UpdateOperatorTierDto) {
    const tier = await operatorTierRepository.update(id, dto);
    if (!tier) throw AppError.notFound('Operator tier');
    return tier;
  },
};
