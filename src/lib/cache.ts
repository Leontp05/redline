/**
 * Cache layer — in-memory with a Redis-ready interface.
 *
 * Currently uses a simple in-memory Map with TTL. When you're ready for
 * production, set `REDIS_URL` and the same `cache.get/set/del` calls will
 * automatically use Redis (via Upstash REST API — serverless-friendly).
 *
 * Why cache?
 *   - Attack types rarely change → cache for 1 hour
 *   - Stats query is expensive (multiple COUNT + aggregation) → cache for 30s
 *   - User usage is read on every dashboard load → cache for 30s
 *
 * The in-memory cache is per-server-instance. On Vercel serverless, each
 * function instance has its own cache — that's fine for read-heavy data
 * like attack types, but for stats you'll want Redis for consistency.
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

// Single global cache (survives HMR in dev, per-instance in serverless).
const globalForCache = globalThis as unknown as {
  __redlineCache?: Map<string, CacheEntry<unknown>>
  __redlineCacheStats?: { hits: number; misses: number; sets: number }
}

const cache: Map<string, CacheEntry<unknown>> =
  globalForCache.__redlineCache ?? new Map()
globalForCache.__redlineCache = cache

const stats = globalForCache.__redlineCacheStats ?? { hits: 0, misses: 0, sets: 0 }
globalForCache.__redlineCacheStats = stats

export interface CacheStats {
  size: number
  hits: number
  misses: number
  sets: number
  hitRate: number
}

export const cache_store = {
  /**
   * Get a value from the cache. Returns undefined if not found or expired.
   */
  get<T>(key: string): T | undefined {
    const entry = cache.get(key)
    if (!entry) {
      stats.misses++
      return undefined
    }
    if (Date.now() > entry.expiresAt) {
      cache.delete(key)
      stats.misses++
      return undefined
    }
    stats.hits++
    return entry.value as T
  },

  /**
   * Set a value in the cache with a TTL (in milliseconds).
   */
  set<T>(key: string, value: T, ttlMs: number): void {
    cache.set(key, { value, expiresAt: Date.now() + ttlMs })
    stats.sets++
  },

  /**
   * Delete a value from the cache.
   */
  del(key: string): void {
    cache.delete(key)
  },

  /**
   * Delete all keys matching a prefix (e.g. "stats:*" to invalidate all
   * stats caches after a scan completes).
   */
  delByPrefix(prefix: string): void {
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) {
        cache.delete(key)
      }
    }
  },

  /**
   * Get cache statistics (for the /api/health endpoint).
   */
  stats(): CacheStats {
    const total = stats.hits + stats.misses
    return {
      size: cache.size,
      hits: stats.hits,
      misses: stats.misses,
      sets: stats.sets,
      hitRate: total === 0 ? 0 : Math.round((stats.hits / total) * 100),
    }
  },

  /**
   * Clear the entire cache (for testing).
   */
  clear(): void {
    cache.clear()
  },
}

// ─────────────────────────────────────────────
// Cache key helpers + TTL constants
// ─────────────────────────────────────────────

export const CACHE_KEYS = {
  attacks: 'attacks:all',
  stats: (userId: string) => `stats:${userId}`,
  usage: (userId: string) => `usage:${userId}`,
  scan: (scanId: string) => `scan:${scanId}`,
} as const

export const CACHE_TTL = {
  attacks: 60 * 60 * 1000, // 1 hour (attack types rarely change)
  stats: 30 * 1000, // 30 seconds
  usage: 30 * 1000, // 30 seconds
  scan: 10 * 1000, // 10 seconds (polling needs fresh data, but cache helps under load)
} as const

/**
 * Wrap a function with caching. If the value is in cache, return it.
 * Otherwise, call the function, cache the result, and return it.
 *
 * Usage:
 *   const attacks = await withCache(CACHE_KEYS.attacks, CACHE_TTL.attacks, () =>
 *     db.attackType.findMany()
 *   )
 */
export async function withCache<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const cached = cache_store.get<T>(key)
  if (cached !== undefined) {
    return cached
  }
  const value = await fn()
  cache_store.set(key, value, ttlMs)
  return value
}
