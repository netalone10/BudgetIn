# Database Connection Pool Configuration

## Overview

BudgetIn uses Prisma ORM with PostgreSQL (Supabase) and pgbouncer for connection pooling, optimized for Vercel's serverless environment.

## Architecture

```
Vercel Serverless Functions
    │
    ├── Runtime queries ──► pgbouncer (port 6543) ──► PostgreSQL
    │   (DATABASE_URL)        connection pooler
    │
    └── Migrations ──────► PostgreSQL directly (port 5432)
        (DIRECT_URL)         no pooler
```

## Why pgbouncer?

Vercel serverless functions spin up and down frequently. Without a connection pooler, each function invocation could open a new database connection, quickly exhausting PostgreSQL's connection limit. pgbouncer sits between the application and the database, managing a pool of reusable connections.

## Configuration

### `DATABASE_URL` (Runtime)

Used by Prisma for all runtime queries (reads and writes).

```
postgresql://USER:PASSWORD@HOST:6543/DATABASE?pgbouncer=true&connection_limit=5
```

Key parameters:
- **Port 6543**: pgbouncer pooler endpoint
- **`pgbouncer=true`**: Tells Prisma to use pgbouncer-compatible mode (disables prepared statements that pgbouncer doesn't support in transaction mode)
- **`connection_limit=5`**: Maximum connections this Prisma instance will open. Set low (1-10) for serverless because multiple function instances run concurrently, each with their own pool.

### `DIRECT_URL` (Migrations only)

Used by Prisma exclusively for `prisma migrate` and `prisma db push` commands.

```
postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

Key parameters:
- **Port 5432**: Direct PostgreSQL connection (bypasses pgbouncer)
- No `pgbouncer` or `connection_limit` parameters needed

This is required because:
1. Prisma migrations use the extended query protocol and advisory locks
2. pgbouncer in transaction mode doesn't support these features
3. Migrations run locally or in CI, not in serverless functions

### Prisma Schema Configuration

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pgbouncer (port 6543) — runtime
  directUrl = env("DIRECT_URL")     // direct (port 5432) — migrations
}
```

## Connection Limit Guidelines

| Environment | Recommended `connection_limit` | Reason |
|---|---|---|
| Vercel Serverless (Production) | 5 | Multiple concurrent instances share the pool |
| Vercel Serverless (Preview) | 3 | Lower traffic, fewer instances |
| Local Development | 10 | Single instance, more headroom |

### How to calculate

Supabase free tier allows ~60 direct connections. With pgbouncer:
- If you expect up to 10 concurrent serverless instances: `60 / 10 = 6` → use `connection_limit=5`
- If you expect up to 20 concurrent serverless instances: `60 / 20 = 3` → use `connection_limit=3`

## Connection Timeout Behavior

When the connection pool is exhausted:
1. Prisma queues the request internally
2. Waits up to **10 seconds** for a connection to become available
3. If no connection is available after 10 seconds, throws a `P2024` connection timeout error

This is configured via Prisma's default pool timeout. To customize:

```
DATABASE_URL="...?pgbouncer=true&connection_limit=5&pool_timeout=10"
```

## Prisma Client Singleton

The application uses a global singleton pattern (`lib/prisma.ts`) to prevent creating multiple Prisma Client instances in development (due to hot module reloading):

```typescript
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: [...] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

In production (Vercel), each serverless function instance creates one Prisma Client with the configured `connection_limit`.

## Troubleshooting

### `P2024: Timed out fetching a new connection from the connection pool`

- **Cause**: All connections in the pool are busy and the 10-second timeout elapsed
- **Fix**: Reduce query complexity, add pagination, or increase `connection_limit` (but stay within total pool budget)

### `prepared statement already exists`

- **Cause**: Missing `pgbouncer=true` in `DATABASE_URL`
- **Fix**: Add `?pgbouncer=true` to the connection string

### Migrations fail with connection errors

- **Cause**: Using `DATABASE_URL` (pgbouncer) for migrations
- **Fix**: Ensure `DIRECT_URL` is set and points to port 5432
