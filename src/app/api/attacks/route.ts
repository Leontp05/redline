import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { listAttackModules } from '@/lib/orchestrator'
import { withCache, CACHE_KEYS, CACHE_TTL, cache_store } from '@/lib/cache'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/attacks
 * Returns all AttackType rows. Cached for 1 hour (attack types rarely change).
 * If the table is empty, seeds it from the in-process ATTACK_MODULES registry.
 *
 * Response shape:
 *   { attacks: AttackType[] }
 */
export async function GET() {
  try {
    const attacks = await withCache(CACHE_KEYS.attacks, CACHE_TTL.attacks, async () => {
      let rows = await db.attackType.findMany({
        orderBy: { severityWeight: 'desc' },
      })
      if (rows.length === 0) {
        logger.info('attacks.seeding', {})
        const modules = listAttackModules()
        await db.attackType.createMany({
          data: modules.map((m) => ({
            key: m.key,
            name: m.name,
            category: m.category,
            severityWeight: m.severityWeight,
            description: m.description,
          })),
        })
        rows = await db.attackType.findMany({
          orderBy: { severityWeight: 'desc' },
        })
      }
      return rows
    })
    return NextResponse.json({ attacks })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('attacks.fetch_failed', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
