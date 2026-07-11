import type { PrismaClient, Result, Scan, AttackType } from '@prisma/client'

import { callTargetModel, callTargetModelMultiTurn } from './llm'
import { callTargetApi, callTargetApiMultiTurn, type ApiTargetConfig } from './api-target'
import { ATTACK_MODULES, getAttackByKey, evaluateSuccess } from './attacks'
import type {
  AttackExecutor,
  AttackModule,
  AttackPayload,
  AttackRunResult,
  AttackTarget,
} from './attacks/types'
import { isMultiTurnConversationPayload } from './attacks/multi-turn'
import { computeScores, type AttackTypeMeta } from './scoring'

/**
 * Orchestrator: run a full scan against a target.
 *
 * For each attack type, for each payload variant:
 *   1. Call the attack module's `run` with an executor backed by
 *      `callTargetModel` / `callTargetModelMultiTurn`.
 *   2. Evaluate success (vulnerability) via `evaluateSuccess`.
 *   3. Persist a `Result` row.
 *
 * After all results land, compute the score and update the Scan row.
 *
 * Concurrency: we batch payloads with a small concurrency limit (3) so the
 * scan finishes in reasonable time without overwhelming the LLM endpoint.
 * Each attack's failure is logged but does not abort the whole scan.
 */

export interface ScanTarget {
  id: string
  systemPrompt: string
  context: string | null
  // API-connect mode (null when mode='simulate').
  mode?: 'simulate' | 'api'
  apiConfig?: ApiTargetConfig | null
}

export type AttackTypeRow = AttackType

/**
 * Build the executor the attack modules call.
 *
 * Routes to the API target (real HTTP fetch) or the simulate LLM based on
 * the target's mode.
 *
 * The executor inspects `payload.payload` to decide between single-turn and
 * multi-turn behavior:
 *   - If `payload.payload` parses as a JSON array of `{ role, content }`
 *     objects (set by the multi-turn module), it calls the multi-turn variant.
 *   - Otherwise, it calls the single-turn variant with the user message,
 *     prepending the (possibly overridden) context — used by the injection
 *     attack to smuggle fake "retrieved documents".
 */
function makeExecutor(apiConfig?: ApiTargetConfig | null): AttackExecutor {
  return {
    async run(
      targetSystemPrompt: string,
      targetContext: string | null,
      payload: AttackPayload
    ): Promise<AttackRunResult> {
      // Multi-turn branch: payload.payload is a JSON array of conversation turns.
      if (isMultiTurnConversationPayload(payload.payload)) {
        try {
          const turns = JSON.parse(payload.payload) as {
            role: 'user' | 'assistant'
            content: string
          }[]
          let response: string
          if (apiConfig) {
            // API-connect mode: send system + all turns to the user's endpoint.
            const allTurns = [
              { role: 'system' as const, content: targetSystemPrompt },
              ...turns,
            ]
            response = await callTargetApiMultiTurn(apiConfig, allTurns)
          } else {
            response = await callTargetModelMultiTurn(targetSystemPrompt, turns)
          }
          const conversation = [
            ...turns,
            { role: 'assistant' as const, content: response },
          ]
          return { response, conversation }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          return { response: `[ERROR] Multi-turn execution failed: ${msg}` }
        }
      }

      // Single-turn branch.
      const ctx =
        payload.contextOverride !== undefined ? payload.contextOverride : targetContext
      const userMessage = ctx
        ? `${ctx}\n\n---\n\n${payload.payload}`
        : payload.payload
      let response: string
      if (apiConfig) {
        response = await callTargetApi(apiConfig, targetSystemPrompt, userMessage)
      } else {
        response = await callTargetModel(targetSystemPrompt, userMessage)
      }
      return { response }
    },
  }
}

/**
 * Run a tiny concurrency-limited map.
 *
 * We process the work list in chunks of `limit` so we never fire more than
 * `limit` LLM calls in parallel. (The target endpoint is rate-limited.)
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = []
  let cursor = 0
  const inFlight: Promise<void>[] = []

  async function runOne(i: number): Promise<void> {
    try {
      const value = await worker(items[i], i)
      results[i] = { status: 'fulfilled', value }
    } catch (reason) {
      results[i] = { status: 'rejected', reason }
    }
  }

  while (cursor < items.length) {
    // Top up in-flight promises up to `limit`.
    while (inFlight.length < limit && cursor < items.length) {
      const idx = cursor++
      const p = runOne(idx)
      inFlight.push(p)
      p.finally(() => {
        // Remove this promise from the in-flight list when done.
        const pos = inFlight.indexOf(p)
        if (pos >= 0) inFlight.splice(pos, 1)
      })
    }
    // Wait for at least one to finish before topping up again.
    if (inFlight.length > 0) {
      await Promise.race(inFlight)
    }
  }
  await Promise.allSettled(inFlight)
  return results
}

/**
 * Run a full scan: for every selected attack type, run every payload variant,
 * persist results, then compute the score and mark the scan complete.
 */
export async function runScan(
  scanId: string,
  target: ScanTarget,
  attackTypes: AttackTypeRow[],
  db: PrismaClient
): Promise<void> {
  try {
    const executor = makeExecutor(target.apiConfig)
    const attackTarget: AttackTarget = {
      systemPrompt: target.systemPrompt,
      context: target.context,
    }

    // Build the flat work list: one entry per (attackType, payload).
    interface WorkItem {
      attackType: AttackTypeRow
      attackModule: AttackModule
      payload: AttackPayload
    }
    const work: WorkItem[] = []
    for (const at of attackTypes) {
      const attackModule = getAttackByKey(at.key)
      if (!attackModule) {
        console.warn(`[orchestrator] No module found for attack key "${at.key}" — skipping.`)
        continue
      }
      for (const payload of attackModule.payloads) {
        work.push({ attackType: at, attackModule, payload })
      }
    }

    // Run all work items at concurrency 2. We use a low limit because the
    // upstream LLM endpoint is rate-limited; the LLM wrapper also retries
    // 429s with exponential backoff + jitter (see src/lib/llm.ts).
    await mapWithConcurrency(work, 2, async (item) => {
      const { attackType, attackModule, payload } = item
      let result: AttackRunResult
      try {
        result = await attackModule.run(executor, attackTarget, payload)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        result = { response: `[ERROR] Attack module threw: ${msg}` }
      }

      // If the module didn't return a response (defensive), synthesize one.
      if (!result || typeof result.response !== 'string') {
        result = { response: '[ERROR] Attack module returned no response.' }
      }

      const evalResult = evaluateSuccess(attackModule, payload, result.response)

      const conversationJson = result.conversation
        ? JSON.stringify(result.conversation)
        : null

      await db.result.create({
        data: {
          scanId,
          attackTypeId: attackType.id,
          technique: payload.technique,
          payload: payload.payload,
          response: result.response,
          success: evalResult.success,
          evidence: evalResult.evidence,
          conversation: conversationJson,
        },
      })
    })

    // Fetch all results + attack type metadata to compute the score.
    const results: Result[] = await db.result.findMany({
      where: { scanId },
    })
    const attackTypeMetas: AttackTypeMeta[] = attackTypes.map((at) => ({
      id: at.id,
      key: at.key,
      category: at.category,
      severityWeight: at.severityWeight,
    }))

    const { overallScore, categoryScores } = computeScores(results, attackTypeMetas)

    await db.scan.update({
      where: { id: scanId },
      data: {
        status: 'complete',
        overallScore,
        categoryScores: JSON.stringify(categoryScores),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[orchestrator] Scan ${scanId} failed:`, msg)
    await db.scan
      .update({
        where: { id: scanId },
        data: { status: 'failed' },
      })
      .catch(() => {
        // Ignore — we're already in error handling.
      })
    throw err
  }
}

/**
 * Convenience: list every AttackModule in registry form (used by `/api/attacks`
 * seeding). Returns a shallow copy so callers can't mutate the registry.
 */
export function listAttackModules(): AttackModule[] {
  return ATTACK_MODULES.map((m) => ({
    ...m,
    payloads: m.payloads.map((p) => ({ ...p })),
  }))
}

export type { Scan }
