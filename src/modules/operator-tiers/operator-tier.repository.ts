import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import {
  CreateOperatorTierDto,
  ListOperatorTiersQuery,
  UpdateOperatorTierDto,
} from './operator-tier.schema';

export interface OperatorTierRow {
  id: bigint;
  tierName: string;
  /** Postgres interval rendered as text, e.g. "30 days". */
  expirationWindow: string;
  isActive: boolean;
  createdAt: Date;
}

// Prisma Client cannot select the Postgres INTERVAL column, so this repository uses raw SQL.
const COLUMNS = Prisma.sql`tier_id AS "id", tier_name AS "tierName",
  expiration_window::text AS "expirationWindow", is_active AS "isActive", created_at AS "createdAt"`;

export const operatorTierRepository = {
  findAll: (q: ListOperatorTiersQuery) =>
    prisma.$queryRaw<OperatorTierRow[]>`
      SELECT ${COLUMNS} FROM operator_tiers
      WHERE (${q.isActive ?? null}::boolean IS NULL OR is_active = ${q.isActive ?? null}::boolean)
      ORDER BY tier_id
      LIMIT ${q.limit} OFFSET ${q.offset}`,

  async findById(id: bigint) {
    const rows = await prisma.$queryRaw<OperatorTierRow[]>`
      SELECT ${COLUMNS} FROM operator_tiers WHERE tier_id = ${id}`;
    return rows[0] ?? null;
  },

  async create(dto: CreateOperatorTierDto) {
    const rows = await prisma.$queryRaw<OperatorTierRow[]>`
      INSERT INTO operator_tiers (tier_name, expiration_window, is_active)
      VALUES (${dto.tierName}, ${dto.expirationWindow}::interval, ${dto.isActive ?? true}::boolean)
      RETURNING ${COLUMNS}`;
    return rows[0];
  },

  async update(id: bigint, dto: UpdateOperatorTierDto) {
    const rows = await prisma.$queryRaw<OperatorTierRow[]>`
      UPDATE operator_tiers SET
        tier_name = COALESCE(${dto.tierName ?? null}::text, tier_name),
        expiration_window = COALESCE(${dto.expirationWindow ?? null}::interval, expiration_window),
        is_active = COALESCE(${dto.isActive ?? null}::boolean, is_active)
      WHERE tier_id = ${id}
      RETURNING ${COLUMNS}`;
    return rows[0] ?? null;
  },
};
