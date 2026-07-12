import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cache_store } from '@/lib/cache'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/benchmark
 *
 * Public (no auth) — returns aggregated security scores by LLM model.
 * Drives the public benchmark leaderboard on the landing page.
 *
 * Only includes:
 *   - Completed scans with a non-null overallScore
 *   - API-connect targets (we know the actual model)
 *   - Models with at least 1 scan
 *
 * Returns:
 *   {
 *     models: [{ model, avgScore, minScore, maxScore, scanCount, ... }],
 *     totalScans: number,
 *     avgScoreAll: number,
 *     topCategoryVulnerabilities: [{ category, avgVulnerableRate }]
 *   }
 */
export async function GET() {
  try {
    // Check cache first (1 hour TTL — benchmark doesn't need to be real-time)
    const cacheKey = 'benchmark:all'
    const cached = cache_store.get<unknown>(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    // Get all completed API-connect scans with their target's model name
    const scans = await db.scan.findMany({
      where: {
        status: 'complete',
        overallScore: { not: null },
        target: {
          mode: 'api',
          apiModel: { not: null },
        },
      },
      select: {
        overallScore: true,
        categoryScores: true,
        target: {
          select: { apiModel: true },
        },
      },
    })

    // If not enough data, return empty state
    if (scans.length === 0) {
      const emptyResult = {
        models: [],
        totalScans: 0,
        avgScoreAll: null,
        topCategoryVulnerabilities: [],
        message: 'No API-connect scans yet. Be the first to contribute — connect your LLM endpoint and run a scan.',
      }
      cache_store.set(cacheKey, emptyResult, 60 * 60 * 1000)
      return NextResponse.json(emptyResult)
    }

    // Group by model name
    const modelMap = new Map<
      string,
      {
        model: string
        scores: number[]
        categories: Record<string, number[]>
      }
    >()

    for (const scan of scans) {
      const model = scan.target.apiModel || 'unknown'
      if (!modelMap.has(model)) {
        modelMap.set(model, {
          model,
          scores: [],
          categories: {},
        })
      }
      const entry = modelMap.get(model)!
      entry.scores.push(scan.overallScore!)

      // Parse category scores
      if (scan.categoryScores) {
        try {
          const cats = JSON.parse(scan.categoryScores) as Record<string, number>
          for (const [cat, score] of Object.entries(cats)) {
            if (!entry.categories[cat]) entry.categories[cat] = []
            entry.categories[cat].push(score)
          }
        } catch {
          // skip invalid JSON
        }
      }
    }

    // Build the leaderboard
    const models = Array.from(modelMap.values())
      .map((entry) => {
        const avgScore = Math.round(
          entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length,
        )
        const minScore = Math.min(...entry.scores)
        const maxScore = Math.max(...entry.scores)

        // Calculate per-category averages
        const categoryAverages: Record<string, number> = {}
        for (const [cat, scores] of Object.entries(entry.categories)) {
          categoryAverages[cat] = Math.round(
            scores.reduce((a, b) => a + b, 0) / scores.length,
          )
        }

        return {
          model: entry.model,
          avgScore,
          minScore,
          maxScore,
          scanCount: entry.scores.length,
          categories: categoryAverages,
        }
      })
      .sort((a, b) => b.avgScore - a.avgScore)

    // Overall averages
    const allScores = scans.map((s) => s.overallScore!)
    const avgScoreAll = Math.round(
      allScores.reduce((a, b) => a + b, 0) / allScores.length,
    )

    // Top vulnerable categories across ALL scans
    const categoryVulnRates = new Map<string, { total: number; sum: number }>()
    for (const scan of scans) {
      if (!scan.categoryScores) continue
      try {
        const cats = JSON.parse(scan.categoryScores) as Record<string, number>
        for (const [cat, score] of Object.entries(cats)) {
          if (!categoryVulnRates.has(cat)) {
            categoryVulnRates.set(cat, { total: 0, sum: 0 })
          }
          const entry = categoryVulnRates.get(cat)!
          entry.total++
          entry.sum += 100 - score // vulnerability rate = 100 - security score
        }
      } catch {
        // skip
      }
    }

    const topCategoryVulnerabilities = Array.from(categoryVulnRates.entries())
      .map(([category, { total, sum }]) => ({
        category,
        avgVulnerableRate: Math.round(sum / total),
      }))
      .sort((a, b) => b.avgVulnerableRate - a.avgVulnerableRate)
      .slice(0, 5)

    const result = {
      models,
      totalScans: scans.length,
      avgScoreAll,
      topCategoryVulnerabilities,
    }

    // Cache for 1 hour
    cache_store.set(cacheKey, result, 60 * 60 * 1000)

    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('benchmark.fetch_failed', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
