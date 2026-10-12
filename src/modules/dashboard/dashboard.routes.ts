import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../common/middlewares/validate';
import { asyncHandler } from '../../common/utils/async-handler';
import { bigIntParam, parsedQuery } from '../../common/utils/params';
import { bigIntIdSchema, paginationQuerySchema } from '../../common/schemas';
import { BalanceSnapshot, readSnapshot, subscribeBalance } from '../operator-balances/balance-events';
import { dashboardService } from './dashboard.service';

export const dashboardRoutes = Router();

const operatorParam = z.object({ operatorId: bigIntIdSchema });

/** Live balance, status level, next expiry and recent activity for one operator. */
dashboardRoutes.get(
  '/:operatorId',
  validate(operatorParam, 'params'),
  asyncHandler(async (req, res) => {
    res.json(await dashboardService.get(bigIntParam(req, 'operatorId')));
  }),
);

/**
 * Server-Sent Events: sends the current balance immediately, then a `balance` event every time any
 * request (this operator's or a supervisor's) or the expiration sweep changes it. Clients use the
 * built-in EventSource reconnect; `version` lets them ignore out-of-order snapshots.
 */
dashboardRoutes.get(
  '/:operatorId/stream',
  validate(operatorParam, 'params'),
  asyncHandler(async (req, res) => {
    const operatorId = bigIntParam(req, 'operatorId');
    await dashboardService.get(operatorId); // 404 before the stream opens; applies due expirations

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const send = (s: BalanceSnapshot) => res.write(`event: balance\ndata: ${JSON.stringify(s)}\n\n`);

    const unsubscribe = subscribeBalance(operatorId, send);
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });

    const initial = await readSnapshot(operatorId);
    if (initial) send(initial);
  }),
);

/** Ledger history with running totals and status level after each entry. */
dashboardRoutes.get(
  '/:operatorId/timeline',
  validate(operatorParam, 'params'),
  validate(paginationQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { limit, offset } = parsedQuery<z.infer<typeof paginationQuerySchema>>(req);
    res.json(await dashboardService.timeline(bigIntParam(req, 'operatorId'), limit, offset));
  }),
);
