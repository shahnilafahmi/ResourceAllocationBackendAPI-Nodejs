import { Request, Response } from 'express';
import { bigIntParam, parsedQuery } from '../../common/utils/params';
import { statusLevelService } from './status-level.service';

export const statusLevelController = {
  list: async (req: Request, res: Response) => {
    const { limit, offset } = parsedQuery<{ limit: number; offset: number }>(req);
    res.json(await statusLevelService.list(limit, offset));
  },
  get: async (req: Request, res: Response) => {
    res.json(await statusLevelService.get(bigIntParam(req)));
  },
  create: async (req: Request, res: Response) => {
    res.status(201).json(await statusLevelService.create(req.body));
  },
  update: async (req: Request, res: Response) => {
    res.json(await statusLevelService.update(bigIntParam(req), req.body));
  },
  remove: async (req: Request, res: Response) => {
    await statusLevelService.remove(bigIntParam(req));
    res.status(204).send();
  },
};
