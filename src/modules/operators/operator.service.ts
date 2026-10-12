import { AppError } from '../../common/errors/app-error';
import { operatorTierRepository } from '../operator-tiers/operator-tier.repository';
import { operatorRepository } from './operator.repository';
import { CreateOperatorDto, ListOperatorsQuery, UpdateOperatorDto } from './operator.schema';

export const operatorService = {
  list: (q: ListOperatorsQuery) => operatorRepository.findAll(q),

  async get(id: bigint) {
    const operator = await operatorRepository.findById(id);
    if (!operator) throw AppError.notFound('Operator');
    return operator;
  },

  async create(dto: CreateOperatorDto) {
    if (!(await operatorTierRepository.findById(dto.tierId))) throw AppError.notFound('Operator tier');
    return operatorRepository.create(dto);
  },

  async update(id: bigint, dto: UpdateOperatorDto) {
    await this.get(id);
    if (dto.tierId !== undefined && !(await operatorTierRepository.findById(dto.tierId))) {
      throw AppError.notFound('Operator tier');
    }
    return operatorRepository.update(id, dto);
  },
};
