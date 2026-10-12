import { Request, Response } from 'express';
import { bigIntParam, parsedQuery } from '../../common/utils/params';
import { supervisorAdjustmentService } from './supervisor-adjustment.service';
import { ListSupervisorAdjustmentsQuery } from './supervisor-adjustment.schema';

export const supervisorAdjustmentController = {
  list: async (req: Request, res: Response) => {
    res.json(await supervisorAdjustmentService.list(parsedQuery<ListSupervisorAdjustmentsQuery>(req)));
  },
  get: async (req: Request, res: Response) => {
    res.json(await supervisorAdjustmentService.get(bigIntParam(req)));
  },
  create: async (req: Request, res: Response) => {
    res.status(201).json(await supervisorAdjustmentService.create(req.body));
  },
  updateRecalculationStatus: async (req: Request, res: Response) => {
    res.json(await supervisorAdjustmentService.updateRecalculationStatus(bigIntParam(req), req.body));
  },
};
