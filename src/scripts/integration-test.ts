import { randomUUID } from 'node:crypto';
import { prisma } from '../database/prisma';
import { dashboardService } from '../modules/dashboard/dashboard.service';
import { resourceAllocationService as alloc } from '../modules/resource-allocations/resource-allocation.service';
import { supervisorAdjustmentService as adj } from '../modules/supervisor-adjustments/supervisor-adjustment.service';

let failures = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + JSON.stringify(extra, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))}`);
};
const units = async (id: bigint) => (await dashboardService.get(id)).balance.currentUnits.toString();
const settled = async (ps: Promise<unknown>[]) => Promise.allSettled(ps);
const ok = (r: PromiseSettledResult<unknown>[]) => r.filter((x) => x.status === 'fulfilled').length;

async function main() {
  const tag = `IT${Date.now()}`;
  const ids = { tiers: [] as bigint[], ops: [] as bigint[], levels: [] as bigint[] };

  const mkTier = async (name: string, window: string) => {
    await prisma.$executeRaw`INSERT INTO operator_tiers (tier_name, expiration_window) VALUES (${name}, ${window}::interval)`;
    const t = await prisma.operatorTier.findUniqueOrThrow({ where: { tierName: name } });
    ids.tiers.push(t.id);
    return t.id;
  };
  const mkOp = async (name: string, tierId: bigint) => {
    const o = await prisma.operator.create({ data: { fullName: name, tierId } });
    ids.ops.push(o.id);
    return o.id;
  };

  try {
    const hourTier = await mkTier(`${tag}-hour`, '1 hour');
    const noExpiryTier = await mkTier(`${tag}-none`, '0 seconds');
    const low = await prisma.statusLevel.create({ data: { name: `${tag}-low`, minUnits: '0', maxUnits: '99.99', priority: 1000 } });
    const high = await prisma.statusLevel.create({ data: { name: `${tag}-high`, minUnits: '100', priority: 1000 } });
    ids.levels.push(low.id, high.id);

    // 1. simultaneous allocations
    const a = await mkOp(`${tag}-A`, hourTier);
    const r1 = await settled(
      Array.from({ length: 20 }, () => alloc.create({ operatorId: a, unitsDelta: '5', idempotencyKey: randomUUID() })),
    );
    check('20 concurrent +5 all succeed', ok(r1) === 20, r1.filter((x) => x.status === 'rejected'));
    check('balance is exactly 100', (await units(a)) === '100', await units(a));
    const bal = await prisma.operatorBalance.findUniqueOrThrow({ where: { operatorId: a } });
    check('status level is high', bal.currentStatusLevelId === high.id);

    // 2. duplicate submissions
    const key = randomUUID();
    const r2 = await settled(Array.from({ length: 6 }, () => alloc.create({ operatorId: a, unitsDelta: '1', idempotencyKey: key })));
    const rows = await prisma.resourceAllocation.count({ where: { idempotencyKey: key } });
    check('6 duplicate submissions -> 1 row', rows === 1 && ok(r2) === 6, { rows, ok: ok(r2) });
    check('balance 101 after duplicates', (await units(a)) === '101', await units(a));

    // 3. simultaneous debits cannot overdraw
    const r3 = await settled(Array.from({ length: 15 }, () => alloc.create({ operatorId: a, unitsDelta: '-10.00' })));
    check('exactly 10 of 15 concurrent -10 succeed', ok(r3) === 10, ok(r3));
    check('balance ends at 1 (never negative)', (await units(a)) === '1', await units(a));

    // 4. expiry derived from tier + already-expired entry
    const stale = await alloc.create({
      operatorId: a, unitsDelta: '30', effectiveAt: new Date(Date.now() - 2 * 3600_000),
    });
    check('credit effective 2h ago (1h window) is expired at once', (await units(a)) === '1', await units(a));
    check('expiration entry written', (await prisma.resourceAllocation.count({
      where: { operatorId: a, allocationType: 'EXPIRATION' } })) >= 1);
    void stale;
    const fresh = await alloc.create({ operatorId: a, unitsDelta: '40' });
    check('fresh credit gets expires_at ~ +1h', !!fresh.allocation.expiresAt &&
      Math.abs(fresh.allocation.expiresAt.getTime() - Date.now() - 3600_000) < 60_000);
    check('balance 41', (await units(a)) === '41', await units(a));

    // 5. lazy expiry on read, after part was spent
    await prisma.resourceAllocation.update({ where: { id: fresh.allocation.id }, data: { effectiveAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() - 1000) } });
    const dash = await dashboardService.get(a);
    check('expired credit removed on read (balance 1)', dash.balance.currentUnits.toString() === '1', dash.balance.currentUnits.toString());

    // 6. retroactive adjustment recalculates downstream status
    const c = await mkOp(`${tag}-C`, noExpiryTier);
    const day = (n: number) => new Date(Date.now() - n * 86400_000);
    const first = await alloc.create({ operatorId: c, unitsDelta: '60', effectiveAt: day(3) });
    await alloc.create({ operatorId: c, unitsDelta: '60', effectiveAt: day(2) });
    check('C balance 120 / high', (await units(c)) === '120');
    await adj.create({
      operatorId: c, allocationId: first.allocation.id, supervisorId: c,
      adjustmentDelta: '-30', effectiveAt: day(3), reason: 'miscounted',
    });
    check('after retro -30: balance 90', (await units(c)) === '90', await units(c));
    const d2 = await dashboardService.get(c);
    check('status dropped to low', d2.balance.statusLevel?.id === low.id, d2.balance.statusLevel);
    const tl = await dashboardService.timeline(c, 50, 0);
    check('timeline running totals 60 -> 30 (adjustment) -> 90, oldest first',
      tl.map((r) => Number(r.runningUnits)).reverse().join(',') === '60,30,90', tl.map((r) => r.runningUnits));
    check('timeline status follows running total (low, low, low)',
      tl.every((r) => r.statusLevel?.id === low.id), tl.map((r) => r.statusLevel));
    const before = (await prisma.supervisorAdjustment.count({ where: { operatorId: c } }));
    const bad = await settled([adj.create({
      operatorId: c, allocationId: first.allocation.id, supervisorId: c,
      adjustmentDelta: '-500', effectiveAt: day(3), reason: 'too much',
    })]);
    check('adjustment that would go negative is rejected', bad[0]!.status === 'rejected');
    check('...and leaves no trace', (await units(c)) === '90' &&
      (await prisma.supervisorAdjustment.count({ where: { operatorId: c } })) === before);
    const completed = await prisma.supervisorAdjustment.findFirstOrThrow({ where: { operatorId: c } });
    check('adjustment marked COMPLETED', completed.recalculationStatus === 'COMPLETED' && !!completed.recalculatedAt);

    // 7. void
    await alloc.void(first.allocation.id, null);
    check('void first (+60) also reverses its -30 adjustment -> 60', (await units(c)) === '60', await units(c));
    const again = await settled([alloc.void(first.allocation.id, null)]);
    check('double void rejected', again[0]!.status === 'rejected');
  } finally {
    const { ops, tiers, levels } = ids;
    await prisma.activityLog.deleteMany({ where: { operatorId: { in: ops } } });
    await prisma.supervisorAdjustment.deleteMany({ where: { operatorId: { in: ops } } });
    await prisma.resourceAllocation.deleteMany({ where: { operatorId: { in: ops } } });
    await prisma.operatorBalance.deleteMany({ where: { operatorId: { in: ops } } });
    await prisma.operator.deleteMany({ where: { id: { in: ops } } });
    await prisma.operatorTier.deleteMany({ where: { id: { in: tiers } } });
    await prisma.statusLevel.deleteMany({ where: { id: { in: levels } } });
    await prisma.$disconnect();
  }
  console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });
