import { Request, Response } from 'express';
import { bigIntParam, parsedQuery } from '../../common/utils/params';
import { activityLogService } from './activity-log.service';
import { ListActivityLogsQuery } from './activity-log.schema';

export const activityLogController = {
  list: async (req: Request, res: Response) => {
    res.json(await activityLogService.list(parsedQuery<ListActivityLogsQuery>(req)));
  },
  get: async (req: Request, res: Response) => {
    res.json(await activityLogService.get(bigIntParam(req)));
  },
  create: async (req: Request, res: Response) => {
    res.status(201).json(await activityLogService.create(req.body));
  },
};
