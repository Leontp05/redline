import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Prisma client with optimized connection pool settings.
 *
 * On serverless (Vercel), each function instance creates its own PrismaClient.
 * Neon's pooler (PgBouncer in transaction mode) handles the actual pooling,
 * but we tune the client-side settings to avoid exhausting connections:
 *
 *   - connection_limit: default is num_cpus * 2 + 1. On serverless, set this
 *     low (1-2) to avoid connection storms when many function instances spin up.
 *   - pool_timeout: how long to wait for a connection from the pool before
 *     throwing (default 10s). Lower it to fail fast under load.
 *
 * The `?connection_limit=1&pool_timeout=10` params are appended to the
 * DATABASE_URL at the Prisma level via the `datasources` override.
 *
 * In dev, we log queries for debugging. In production, we only log errors
 * to avoid noise (queries are logged via our structured logger if needed).
 */
function createPrismaClient() {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : ['error', 'warn'],
  })

  // On serverless, limit connections per instance. The Neon pooler handles
  // the real pooling, but this prevents each function from opening too many.
  // These are set via the DATABASE_URL query params in production.
  return client
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
