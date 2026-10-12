# Resource Allocation API – Developer Reference

**Base URL (local):** `http://localhost:3000`
**API root:** `http://localhost:3000/api`
**Format:** JSON over HTTP (`Content-Type: application/json`), except the SSE stream.

---

## 1. Quick start

```bash
npm install
cp .env.example .env          # set DATABASE_URL (PostgreSQL) and optionally PORT
npx prisma generate
npm run dev                   # http://localhost:3000/api
```

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DATABASE_URL` | – | PostgreSQL connection string |
| `EXPIRATION_JOB_INTERVAL_MS` | `60000` | How often expired units are swept; `0` disables the job |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated browser origins allowed by CORS (e.g. the React dev server) |

> The database schema is managed by SQL, not Prisma migrations. Do **not** run `prisma migrate`; use `prisma db pull` to re-sync `prisma/schema.prisma`.

---

## 2. Conventions

| Topic | Rule |
|---|---|
| IDs | Positive 64-bit integers. Returned as **strings** in JSON (`"id": "12"`); send as number or digit string. |
| Decimals | `NUMERIC(14,2)` (max 12 integer digits, 2 decimals). Returned as **strings** (`"25.00"`). Send as string (preferred) or number. |
| Timestamps | ISO-8601 **with offset**, e.g. `2026-10-12T09:00:00Z`. Stored and returned in UTC. |
| Pagination | `limit` (1–200, default 50) and `offset` (default 0) on every list endpoint. |
| Booleans in query | `true` or `false` (lower-case). |
| Updates | `PATCH` with only the fields to change. There are no `PUT` endpoints. |
| Empty PATCH | Rejected (400) – send at least one field. |

### Error format

```json
{ "message": "Human readable message", "details": { } }
```

| Status | Meaning |
|---|---|
| 400 | Validation failed (`details.fieldErrors` lists fields) or a DB check constraint was violated |
| 404 | Record or route not found |
| 409 | Business conflict: duplicate unique value, foreign-key conflict, insufficient units, stale `version`, already voided |
| 500 | Unexpected server error |

Validation example:

```json
{
  "message": "Validation failed",
  "details": { "formErrors": [], "fieldErrors": { "unitsDelta": ["Must not be zero"] } }
}
```

---

## 3. Core business rules

1. **Allocations are an append-only ledger.** `unitsDelta > 0` adds units, `< 0` consumes them. They cannot be edited or deleted; mistakes are **voided** or corrected with a **supervisor adjustment**.
2. **The balance is derived** from the ledger. Every create/void/adjustment recalculates `currentUnits` and the status level inside one transaction, serialised per operator.
3. **No negative balances.** A request that would take the balance below 0 fails with `409`.
4. **Status level** = the level whose `[minUnits, maxUnits]` range contains the balance (highest `minUnits` wins, then `priority`).
5. **Expiry.** A positive `NORMAL` allocation expires at `effectiveAt + tier.expirationWindow`. A sweep (and any read of the dashboard) writes an `EXPIRATION` ledger row for units that have expired.
6. **Idempotency.** `POST /api/resource-allocations` with an `idempotencyKey` that was already used returns the original row with `200` instead of creating a duplicate.
7. **Live updates** are delivered via Server-Sent Events (see Dashboard).

---

## 4. Resource objects

| Object | Fields |
|---|---|
| **OperatorTier** | `id`, `tierName`, `expirationWindow` (text, e.g. `"30 days"`), `isActive`, `createdAt` |
| **Operator** | `id`, `fullName`, `email`, `tierId`, `isActive`, `createdAt`, `updatedAt` |
| **StatusLevel** | `id`, `statusName`, `minUnits`, `maxUnits` (null = no upper bound), `priority`, `createdAt` |
| **OperatorBalance** | `operatorId`, `currentUnits`, `currentStatusLevelId`, `version`, `updatedAt` |
| **ResourceAllocation** | `id`, `operatorId`, `unitsDelta`, `allocationType` (`NORMAL` \| `SUPERVISOR_ADJUSTMENT` \| `EXPIRATION`), `effectiveAt`, `expiresAt`, `tierId`, `createdBy`, `idempotencyKey`, `isVoided`, `voidedAt`, `createdAt` |
| **SupervisorAdjustment** | `id`, `operatorId`, `allocationId`, `supervisorId`, `adjustmentDelta`, `effectiveAt`, `reason`, `recalculationStatus` (`PENDING` \| `PROCESSING` \| `COMPLETED` \| `FAILED`), `recalculatedAt`, `createdAt` |
| **ActivityLog** | `id`, `operatorId`, `actorId`, `allocationId`, `adjustmentId`, `actionType`, `description`, `metadata` (JSON), `createdAt` |

---

## 5. Endpoints

### 5.1 General

| Method | URL | Description |
|---|---|---|
| GET | `http://localhost:3000/api` | Index of available endpoints |
| GET | `http://localhost:3000/api/health` | Health check → `{ "status": "ok" }` |

---

### 5.2 Operator tiers

| Method | URL | Description |
|---|---|---|
| GET | `http://localhost:3000/api/operator-tiers` | List tiers |
| GET | `http://localhost:3000/api/operator-tiers/:id` | Get one tier |
| POST | `http://localhost:3000/api/operator-tiers` | Create a tier |
| PATCH | `http://localhost:3000/api/operator-tiers/:id` | Update a tier |

**GET list – query:** `isActive` (`true`/`false`), `limit`, `offset`

**POST body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `tierName` | string (1–50) | yes | unique |
| `expirationWindow` | string | yes | non-negative interval: `"30 days"`, `"1 hour 30 minutes"`, `"01:30:00"` |
| `isActive` | boolean | no | default `true` |

```json
{ "tierName": "Gold", "expirationWindow": "30 days", "isActive": true }
```

**PATCH body:** any of `tierName`, `expirationWindow`, `isActive` (at least one).

**201 response**

```json
{ "id": "1", "tierName": "Gold", "expirationWindow": "30 days", "isActive": true, "createdAt": "2026-10-12T09:00:00.000Z" }
```

---

### 5.3 Operators

| Method | URL | Description |
|---|---|---|
| GET | `http://localhost:3000/api/operators` | List operators |
| GET | `http://localhost:3000/api/operators/:id` | Get one operator |
| POST | `http://localhost:3000/api/operators` | Create operator (also creates an empty balance) |
| PATCH | `http://localhost:3000/api/operators/:id` | Update operator |

**GET list – query:** `tierId`, `isActive`, `limit`, `offset`

**POST body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `fullName` | string (1–150) | yes | |
| `tierId` | id | yes | must exist (404 otherwise) |
| `email` | string \| null | no | valid email, max 255, unique, lower-cased |
| `isActive` | boolean | no | default `true` |

```json
{ "fullName": "Ann Lee", "email": "ann@example.com", "tierId": 1, "isActive": true }
```

**PATCH body:** any of `fullName`, `email`, `tierId`, `isActive` (at least one).

---

### 5.4 Status levels

| Method | URL | Description |
|---|---|---|
| GET | `http://localhost:3000/api/status-levels` | List levels (ordered by `minUnits`) |
| GET | `http://localhost:3000/api/status-levels/:id` | Get one level |
| POST | `http://localhost:3000/api/status-levels` | Create level |
| PATCH | `http://localhost:3000/api/status-levels/:id` | Update level |
| DELETE | `http://localhost:3000/api/status-levels/:id` | Delete level (`204`; `409` if still referenced) |

**POST body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `statusName` | string (1–50) | yes | unique |
| `minUnits` | decimal ≥ 0 | yes | |
| `maxUnits` | decimal ≥ `minUnits` \| null | no | `null` = unbounded |
| `priority` | integer | no | default `1` |

```json
{ "statusName": "Gold", "minUnits": "100.00", "maxUnits": "499.99", "priority": 2 }
```

**PATCH body:** any of the above (at least one). `maxUnits >= minUnits` is re-checked against the stored row.

---

### 5.5 Operator balances

| Method | URL | Description |
|---|---|---|
| GET | `http://localhost:3000/api/operator-balances` | List balances |
| GET | `http://localhost:3000/api/operator-balances/:operatorId` | Get an operator's balance |
| POST | `http://localhost:3000/api/operator-balances` | Create a balance row (409 if one exists) |
| PATCH | `http://localhost:3000/api/operator-balances/:operatorId` | Manual correction with optimistic lock |

**GET list – query:** `currentStatusLevelId`, `limit`, `offset`

**POST body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `operatorId` | id | yes | must exist |
| `currentUnits` | decimal ≥ 0 | no | default `0` |
| `currentStatusLevelId` | id \| null | no | |

**PATCH body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `version` | integer ≥ 0 | **yes** | the `version` you last read; mismatch → `409` |
| `currentUnits` | decimal ≥ 0 | one of these two | |
| `currentStatusLevelId` | id \| null | one of these two | |

```json
{ "version": 3, "currentUnits": "50.00" }
```

> Prefer creating allocations/adjustments over patching balances; balances are normally derived from the ledger.

---

### 5.6 Resource allocations

| Method | URL | Description |
|---|---|---|
| GET | `http://localhost:3000/api/resource-allocations` | List ledger entries (voided hidden by default) |
| GET | `http://localhost:3000/api/resource-allocations/:id` | Get one entry |
| POST | `http://localhost:3000/api/resource-allocations` | Create an allocation |
| POST | `http://localhost:3000/api/resource-allocations/:id/void` | Void an allocation |

**GET list – query:** `operatorId`, `allocationType`, `includeVoided` (`true`/`false`), `from`, `to` (filter `effectiveAt`), `limit`, `offset`

**POST body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `operatorId` | id | yes | must exist and be active |
| `unitsDelta` | decimal, non-zero | yes | `+` adds units, `−` consumes |
| `effectiveAt` | timestamp | no | default now; may be in the past |
| `createdBy` | id \| null | no | acting operator |
| `idempotencyKey` | UUID \| null | no | retries with the same key return the original row (`200`) |
| `allocationType` | string | no | only `NORMAL` is accepted here; others → 400 |
| `expiresAt`, `tierId` | – | no | accepted but ignored: server derives them from the operator's tier |

```json
{
  "operatorId": 1,
  "unitsDelta": "25.00",
  "effectiveAt": "2026-10-12T09:00:00Z",
  "createdBy": 2,
  "idempotencyKey": "3f2b8c1e-7d44-4b0a-9a55-1b2c3d4e5f60"
}
```

**Responses:** `201` new row · `200` idempotent replay · `409` insufficient units / inactive operator

**Void body (optional)**

```json
{ "actorId": 2 }
```

Voiding reverses the allocation, any supervisor-adjustment rows and expiration rows tied to it, and recalculates the balance. `409` if already voided, if the entry is an `EXPIRATION`, or if the balance would go negative.

---

### 5.7 Supervisor adjustments

| Method | URL | Description |
|---|---|---|
| GET | `http://localhost:3000/api/supervisor-adjustments` | List adjustments |
| GET | `http://localhost:3000/api/supervisor-adjustments/:id` | Get one adjustment |
| POST | `http://localhost:3000/api/supervisor-adjustments` | Create + apply an adjustment |
| PATCH | `http://localhost:3000/api/supervisor-adjustments/:id/recalculation-status` | Set recalculation status (worker use) |

**GET list – query:** `operatorId`, `supervisorId`, `allocationId`, `recalculationStatus`, `limit`, `offset`

**POST body (all required)**

| Field | Type | Notes |
|---|---|---|
| `operatorId` | id | owner of the allocation |
| `allocationId` | id | allocation being corrected; must belong to `operatorId`, must not be voided or `EXPIRATION` |
| `supervisorId` | id | |
| `adjustmentDelta` | decimal, non-zero | signed correction |
| `effectiveAt` | timestamp | may be retroactive |
| `reason` | string (1–2000) | |

```json
{
  "operatorId": 1,
  "allocationId": 10,
  "supervisorId": 2,
  "adjustmentDelta": "-5.00",
  "effectiveAt": "2026-10-01T00:00:00Z",
  "reason": "Entered twice by mistake"
}
```

The adjustment is written into the ledger at `effectiveAt`, the balance and status level are recalculated, and the response returns the adjustment with `recalculationStatus: "COMPLETED"`. If the corrected history would make the balance negative, nothing is saved (`409`).

**PATCH body**

```json
{ "recalculationStatus": "COMPLETED", "recalculatedAt": "2026-10-12T10:00:00Z" }
```

`recalculatedAt` is required when status is `COMPLETED`.

---

### 5.8 Activity logs (append-only)

| Method | URL | Description |
|---|---|---|
| GET | `http://localhost:3000/api/activity-logs` | List logs (newest first) |
| GET | `http://localhost:3000/api/activity-logs/:id` | Get one log |
| POST | `http://localhost:3000/api/activity-logs` | Append a log entry |

**GET list – query:** `operatorId`, `actorId`, `allocationId`, `adjustmentId`, `actionType`, `from`, `to`, `limit`, `offset`

**POST body**

| Field | Type | Required |
|---|---|---|
| `operatorId` | id | yes |
| `actionType` | string (1–50) | yes |
| `actorId`, `allocationId`, `adjustmentId` | id \| null | no |
| `description` | string (≤ 2000) \| null | no |
| `metadata` | JSON object | no (default `{}`) |

```json
{ "operatorId": 1, "actorId": 2, "actionType": "NOTE", "description": "Called operator", "metadata": { "channel": "phone" } }
```

The system writes its own entries: `ALLOCATION_CREATED`, `ALLOCATION_VOIDED`, `ADJUSTMENT_APPLIED`, and expiration entries.

---

### 5.9 Dashboard (live view)

| Method | URL | Description |
|---|---|---|
| GET | `http://localhost:3000/api/dashboard/:operatorId` | Current snapshot |
| GET | `http://localhost:3000/api/dashboard/:operatorId/stream` | Live updates (Server-Sent Events) |
| GET | `http://localhost:3000/api/dashboard/:operatorId/timeline` | Ledger history with running totals |

**Snapshot response**

```json
{
  "operator": { "id": "1", "fullName": "Ann Lee", "tier": { "id": "1", "tierName": "Gold" } },
  "balance": {
    "currentUnits": "120.00",
    "statusLevel": { "id": "2", "name": "Gold", "minUnits": "100.00", "maxUnits": "499.99" },
    "version": "7",
    "updatedAt": "2026-10-12T09:00:00.000Z"
  },
  "nextExpiry": { "allocationId": "42", "units": "25.00", "expiresAt": "2026-11-11T09:00:00.000Z" },
  "recentActivity": [ /* last 10 ActivityLog objects */ ],
  "serverTime": "2026-10-12T09:05:00.000Z"
}
```

Any units that expired since the last write are applied before this response is built.

**Stream (SSE)**

```js
const es = new EventSource('http://localhost:3000/api/dashboard/1/stream');
es.addEventListener('balance', (e) => {
  const snap = JSON.parse(e.data);
  // { operatorId, currentUnits, statusLevelId, statusName, version, updatedAt }
});
```

- A `balance` event is sent immediately on connect, then on every change (including changes made by other users or the expiration sweep).
- Use `version` to ignore out-of-order snapshots.
- The server sends `: ping` every 25 s as a heartbeat; `EventSource` reconnects automatically.
- Events are in-process only: with several server instances, add Postgres `LISTEN/NOTIFY` or Redis behind `publishBalance`.

**Timeline – query:** `limit`, `offset`. Each row:

```json
{
  "allocationId": "42", "allocationType": "NORMAL",
  "unitsDelta": "25.00", "runningUnits": "120.00",
  "statusLevel": { "id": "2", "name": "Gold" },
  "effectiveAt": "2026-10-12T09:00:00.000Z",
  "expiresAt": "2026-11-11T09:00:00.000Z",
  "createdAt": "2026-10-12T09:00:01.000Z"
}
```

Rows are in `effectiveAt` order (newest first); a retroactive adjustment changes the running total and status of all later rows.

---

## 6. Example flow

```bash
BASE=http://localhost:3000/api

# 1. reference data
curl -X POST $BASE/operator-tiers  -H 'Content-Type: application/json' \
  -d '{"tierName":"Gold","expirationWindow":"30 days"}'
curl -X POST $BASE/status-levels   -H 'Content-Type: application/json' \
  -d '{"statusName":"Silver","minUnits":"0","maxUnits":"99.99"}'

# 2. an operator
curl -X POST $BASE/operators -H 'Content-Type: application/json' \
  -d '{"fullName":"Ann Lee","email":"ann@example.com","tierId":1}'

# 3. allocate units (idempotent)
curl -X POST $BASE/resource-allocations -H 'Content-Type: application/json' \
  -d '{"operatorId":1,"unitsDelta":"50.00","idempotencyKey":"3f2b8c1e-7d44-4b0a-9a55-1b2c3d4e5f60"}'

# 4. watch it live / read it
curl -N $BASE/dashboard/1/stream
curl    $BASE/dashboard/1
```

## 7. Known limitations

- No authentication or authorisation yet; `createdBy` / `actorId` / `supervisorId` are trusted from the request body.
- SSE fan-out is per process (see Dashboard).
- Operator tiers and operators cannot be deleted; deactivate with `isActive: false`.
