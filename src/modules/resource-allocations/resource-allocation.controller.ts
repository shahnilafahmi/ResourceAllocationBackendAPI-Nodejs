import { Request, Response } from 'express';
import { bigIntParam, parsedQuery } from '../../common/utils/params';
import { resourceAllocationService } from './resource-allocation.service';
import { ListResourceAllocationsQuery } from './resource-allocation.schema';

export const resourceAllocationController = {
  list: async (req: Request, res: Response) => {
    res.json(await resourceAllocationService.list(parsedQuery<ListResourceAllocationsQuery>(req)));
  },
  get: async (req: Request, res: Response) => {
    res.json(await resourceAllocationService.get(bigIntParam(req)));
  },
  create: async (req: Request, res: Response) => {
    const { allocation, created } = await resourceAllocationService.create(req.body);
    res.status(created ? 201 : 200).json(allocation);
  },
  void: async (req: Request, res: Response) => {
    const actorId = req.body?.actorId ? BigInt(req.body.actorId) : null;
    res.json(await resourceAllocationService.void(bigIntParam(req), actorId));
  },
};
