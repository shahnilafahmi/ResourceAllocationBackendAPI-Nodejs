import { AppError } from '../../common/errors/app-error';
import { operatorRepository } from '../operators/operator.repository';
import { operatorBalanceRepository } from './operator-balance.repository';
import { CreateOperatorBalanceDto, UpdateOperatorBalanceDto } from './operator-balance.schema';

export const operatorBalanceService = {
  list: (q: { currentStatusLevelId?: bigint; limit: number; offset: number }) =>
    operatorBalanceRepository.findAll(q),

  async get(operatorId: bigint) {
    const balance = await operatorBalanceRepository.findByOperatorId(operatorId);
    if (!balance) throw AppError.notFound('Operator balance');
    return balance;
  },

  async create(dto: CreateOperatorBalanceDto) {
    if (!(await operatorRepository.findById(dto.operatorId))) throw AppError.notFound('Operator');
    if (await operatorBalanceRepository.findByOperatorId(dto.operatorId)) {
      throw AppError.conflict('This operator already has a balance');
    }
    return operatorBalanceRepository.create(dto);
  },

  async update(operatorId: bigint, dto: UpdateOperatorBalanceDto) {
    await this.get(operatorId);
    const updated = await operatorBalanceRepository.updateIfVersion(operatorId, dto);
    if (updated === 0) {
      throw AppError.conflict('Balance was modified by someone else (version mismatch); re-read and retry');
    }
    return this.get(operatorId);
  },
};
