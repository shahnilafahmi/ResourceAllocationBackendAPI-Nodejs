import { Request, Response } from 'express';
import { bigIntParam, parsedQuery } from '../../common/utils/params';
import { operatorTierService } from './operator-tier.service';
import { ListOperatorTiersQuery } from './operator-tier.schema';

export const operatorTierController = {
  list: async (req: Request, res: Response) => {
    res.json(await operatorTierService.list(parsedQuery<ListOperatorTiersQuery>(req)));
  },
  get: async (req: Request, res: Response) => {
    res.json(await operatorTierService.get(bigIntParam(req)));
  },
  create: async (req: Request, res: Response) => {
    res.status(201).json(await operatorTierService.create(req.body));
  },
  update: async (req: Request, res: Response) => {
    res.json(await operatorTierService.update(bigIntParam(req), req.body));
  },
};
