import { Request, Response } from 'express';
import { bigIntParam, parsedQuery } from '../../common/utils/params';
import { operatorBalanceService } from './operator-balance.service';

export const operatorBalanceController = {
  list: async (req: Request, res: Response) => {
    res.json(
      await operatorBalanceService.list(
        parsedQuery<{ currentStatusLevelId?: bigint; limit: number; offset: number }>(req),
      ),
    );
  },
  get: async (req: Request, res: Response) => {
    res.json(await operatorBalanceService.get(bigIntParam(req, 'operatorId')));
  },
  create: async (req: Request, res: Response) => {
    res.status(201).json(await operatorBalanceService.create(req.body));
  },
  update: async (req: Request, res: Response) => {
    res.json(await operatorBalanceService.update(bigIntParam(req, 'operatorId'), req.body));
  },
};
