import type { Result } from '@prisma/client'

/**
 * Scoring engine.
 *
 * -----------------------------------------------------------------------
 * FORMULA (interview-grade documentation — do not delete)
 * -----------------------------------------------------------------------
 *
 * Definitions:
 *   - A Result with `success=true` means the attack SUCCEEDED against the
 *     target — i.e. the target was VULNERABLE on that payload. (Confusing
 *     naming, but matches the schema comment.)
 *   - "failure rate" of an attack type = (# vulnerable results) / (total
 *     results for that attack type). Higher = worse for the defender.
 *
 * Per-attack-type score (0-100, higher = more secure):
 *   score_i = round(100 * (1 - failureRate_i))
 *
 * Per-category score:
 *   Same formula but scoped to all attack types whose `category` matches.
 *
 * Overall score (weighted by severity):
 *   weightedFailureRate =
 *     Σ_i ( failureRate_i * severityWeight_i )
 *     ─────────────────────────────────────────
 *              Σ_i ( severityWeight_i )
 *
 *   overallScore = round(100 * (1 - weightedFailureRate))
 *
 * Why severity-weighted: an injection success (severity 9) should drag the
 * overall score down much further than an encoding success (severity 6).
 * Using a weighted average instead of a flat mean makes the score reflect
 * real-world risk rather than counting every attack equally.
 *
 * Edge cases:
 *   - Empty results → overall score 100 (nothing got through).
 *   - An attack type with zero results is skipped (avoids div-by-zero).
 */

export interface AttackTypeMeta {
  key: string
  category: string
  severityWeight: number
}

export interface ScoreBreakdown {
  overallScore: number
  categoryScores: Record<string, number>
  perTypeScores: Record<string, number>
  perTypeStats: Record<
    string,
    { total: number; vulnerable: number; failureRate: number; score: number }
  >
}

/**
 * Compute overall + per-category + per-type scores for a set of results.
 *
 * @param results       All Result rows for a single scan.
 * @param attackTypes   The AttackType metadata (key/category/severityWeight)
 *                      for every attack type that participated in the scan.
 */
export function computeScores(
  results: Result[],
  attackTypes: AttackTypeMeta[]
): ScoreBreakdown {
  // Map attackTypeId → metadata, so we can look up category & severity.
  const metaById = new Map(attackTypes.map((a) => [a.id ?? a.key, a]))
  // Also map key → metadata (we'll key per-type stats by AttackType.key).
  // We resolve the key via the result's attackTypeId.
  // Note: AttackTypeMeta has `id` from DB and `key` from the registry. We
  // build a parallel map keyed by `attackTypeId` using whichever field is
  // populated by the caller (see orchestrator: it always passes `id` from
  // the DB row and `key` from the registry).

  // Group results by attack type key.
  const byTypeKey = new Map<
    string,
    { total: number; vulnerable: number; category: string; severity: number }
  >()

  for (const r of results) {
    // Look up metadata by the result's attackTypeId. The orchestrator
    // populates AttackTypeMeta.id with the DB id, so this lookup works.
    const meta = metaById.get(r.attackTypeId)
    if (!meta) continue
    const key = meta.key
    let bucket = byTypeKey.get(key)
    if (!bucket) {
      bucket = {
        total: 0,
        vulnerable: 0,
        category: meta.category,
        severity: meta.severityWeight,
      }
      byTypeKey.set(key, bucket)
    }
    bucket.total += 1
    if (r.success) bucket.vulnerable += 1
  }

  // Per-type score + weighted overall.
  let weightedSum = 0
  let weightTotal = 0
  const perTypeScores: Record<string, number> = {}
  const perTypeStats: ScoreBreakdown['perTypeStats'] = {}

  for (const [key, b] of byTypeKey.entries()) {
    const failureRate = b.total > 0 ? b.vulnerable / b.total : 0
    const score = Math.round(100 * (1 - failureRate))
    perTypeScores[key] = score
    perTypeStats[key] = {
      total: b.total,
      vulnerable: b.vulnerable,
      failureRate,
      score,
    }
    weightedSum += failureRate * b.severity
    weightTotal += b.severity
  }

  const overallScore =
    weightTotal > 0 ? Math.round(100 * (1 - weightedSum / weightTotal)) : 100

  // Per-category score: same formula scoped to a category.
  const byCategory = new Map<string, { weightedSum: number; weightTotal: number }>()
  for (const [, b] of byTypeKey.entries()) {
    const failureRate = b.total > 0 ? b.vulnerable / b.total : 0
    let cat = byCategory.get(b.category)
    if (!cat) {
      cat = { weightedSum: 0, weightTotal: 0 }
      byCategory.set(b.category, cat)
    }
    cat.weightedSum += failureRate * b.severity
    cat.weightTotal += b.severity
  }
  const categoryScores: Record<string, number> = {}
  for (const [cat, c] of byCategory.entries()) {
    categoryScores[cat] =
      c.weightTotal > 0 ? Math.round(100 * (1 - c.weightedSum / c.weightTotal)) : 100
  }

  return { overallScore, categoryScores, perTypeScores, perTypeStats }
}
