import { AppError } from '../../common/errors/app-error';
import { operatorRepository } from '../operators/operator.repository';
import { activityLogRepository } from './activity-log.repository';
import { CreateActivityLogDto, ListActivityLogsQuery } from './activity-log.schema';

export const activityLogService = {
  list: (q: ListActivityLogsQuery) => activityLogRepository.findAll(q),

  async get(id: bigint) {
    const log = await activityLogRepository.findById(id);
    if (!log) throw AppError.notFound('Activity log');
    return log;
  },

  async create(dto: CreateActivityLogDto) {
    if (!(await operatorRepository.findById(dto.operatorId))) throw AppError.notFound('Operator');
    return activityLogRepository.create(dto);
  },
};
