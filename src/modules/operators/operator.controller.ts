import { Request, Response } from 'express';
import { bigIntParam, parsedQuery } from '../../common/utils/params';
import { operatorService } from './operator.service';
import { ListOperatorsQuery } from './operator.schema';

export const operatorController = {
  list: async (req: Request, res: Response) => {
    res.json(await operatorService.list(parsedQuery<ListOperatorsQuery>(req)));
  },
  get: async (req: Request, res: Response) => {
    res.json(await operatorService.get(bigIntParam(req)));
  },
  create: async (req: Request, res: Response) => {
    res.status(201).json(await operatorService.create(req.body));
  },
  update: async (req: Request, res: Response) => {
    res.json(await operatorService.update(bigIntParam(req), req.body));
  },
};
