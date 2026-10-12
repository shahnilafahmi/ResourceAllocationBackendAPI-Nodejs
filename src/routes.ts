import { Router } from 'express';
import { activityLogRoutes } from './modules/activity-logs/activity-log.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { operatorBalanceRoutes } from './modules/operator-balances/operator-balance.routes';
import { operatorTierRoutes } from './modules/operator-tiers/operator-tier.routes';
import { operatorRoutes } from './modules/operators/operator.routes';
import { resourceAllocationRoutes } from './modules/resource-allocations/resource-allocation.routes';
import { statusLevelRoutes } from './modules/status-levels/status-level.routes';
import { supervisorAdjustmentRoutes } from './modules/supervisor-adjustments/supervisor-adjustment.routes';

export const apiRouter = Router();

apiRouter.get('/', (_req, res) =>
  res.json({
    name: 'Resource Allocation API',
    status: 'ok',
    endpoints: [
      '/api/health',
      '/api/operator-tiers',
      '/api/operators',
      '/api/status-levels',
      '/api/operator-balances',
      '/api/resource-allocations',
      '/api/supervisor-adjustments',
      '/api/activity-logs',
      '/api/dashboard',
    ],
  }),
);
apiRouter.get('/health', (_req, res) => res.json({ status: 'ok' }));
apiRouter.use('/operator-tiers', operatorTierRoutes);
apiRouter.use('/operators', operatorRoutes);
apiRouter.use('/status-levels', statusLevelRoutes);
apiRouter.use('/operator-balances', operatorBalanceRoutes);
apiRouter.use('/resource-allocations', resourceAllocationRoutes);
apiRouter.use('/supervisor-adjustments', supervisorAdjustmentRoutes);
apiRouter.use('/activity-logs', activityLogRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
