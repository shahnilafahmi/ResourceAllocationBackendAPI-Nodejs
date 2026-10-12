import { AppError } from '../../common/errors/app-error';
import { publishBalance } from '../operator-balances/balance-events';
import { operatorRepository } from '../operators/operator.repository';
import { resourceAllocationRepository } from '../resource-allocations/resource-allocation.repository';
import { supervisorAdjustmentRepository as repo } from './supervisor-adjustment.repository';
import {
  CreateSupervisorAdjustmentDto,
  ListSupervisorAdjustmentsQuery,
  UpdateRecalculationStatusDto,
} from './supervisor-adjustment.schema';

export const supervisorAdjustmentService = {
  list: (q: ListSupervisorAdjustmentsQuery) => repo.findAll(q),

  async get(id: bigint) {
    const adjustment = await repo.findById(id);
    if (!adjustment) throw AppError.notFound('Supervisor adjustment');
    return adjustment;
  },

  async create(dto: CreateSupervisorAdjustmentDto) {
    if (!(await operatorRepository.findById(dto.operatorId))) throw AppError.notFound('Operator');
    if (!(await operatorRepository.findById(dto.supervisorId))) throw AppError.notFound('Supervisor');

    const allocation = await resourceAllocationRepository.findById(dto.allocationId);
    if (!allocation) throw AppError.notFound('Resource allocation');
    if (allocation.operatorId !== dto.operatorId) {
      throw AppError.badRequest('The allocation does not belong to this operator');
    }
    if (allocation.isVoided) throw AppError.conflict('Cannot adjust a voided allocation');
    if (allocation.allocationType === 'EXPIRATION') {
      throw AppError.conflict('Expiration entries are system-generated and cannot be adjusted');
    }

    const adjustment = await repo.createAndRecalculate(dto);
    await publishBalance(adjustment.operatorId);
    return adjustment;
  },

  async updateRecalculationStatus(id: bigint, dto: UpdateRecalculationStatusDto) {
    await this.get(id);
    return repo.updateRecalculationStatus(id, dto);
  },
};
