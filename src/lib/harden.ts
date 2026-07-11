import type { PrismaClient, Scan, Target, Result, AttackType } from '@prisma/client'

import { hardenPrompt } from './llm'
import { runScan, type ScanTarget, type AttackTypeRow } from './orchestrator'

/**
 * Harden-and-retest flow (multi-tenant).
 *
 * 1. Load the original scan + its target + every Result where `success=true`.
 * 2. Call `hardenPrompt` to rewrite the system prompt.
 * 3. Create a new `Target` row (same userId, version+1, parent=original).
 * 4. Create a new `Scan` for the hardened target.
 * 5. Run the full scan.
 *
 * The `userId` is required to ensure the caller owns the scan being hardened
 * and that the new target/scan inherit the same ownership.
 */
export interface HardenResult {
  originalScan: Scan & { results: Result[] }
  hardenedTarget: Target
  hardenedScan: Scan & { results: Result[] }
}

export async function hardenAndRetest(
  scanId: string,
  userId: string,
  db: PrismaClient,
): Promise<HardenResult> {
  // 1. Load the original scan + target + vulnerable results.
  //    Scope by userId — cannot harden another user's scan.
  const originalScan = await db.scan.findFirst({
    where: { id: scanId, userId },
    include: {
      target: true,
      results: true,
    },
  })
  if (!originalScan) {
    throw new Error(`Scan ${scanId} not found.`)
  }
  if (!originalScan.target) {
    throw new Error(`Scan ${scanId} has no target.`)
  }

  const vulnerableResults = originalScan.results.filter((r) => r.success)
  if (vulnerableResults.length === 0) {
    throw new Error(
      `Scan ${scanId} has no successful attacks — nothing to harden against.`,
    )
  }

  // Fetch attack-type metadata for the harden prompt.
  const attackTypeIds = Array.from(
    new Set(vulnerableResults.map((r) => r.attackTypeId)),
  )
  const attackTypes: AttackType[] = await db.attackType.findMany({
    where: { id: { in: attackTypeIds } },
  })
  const attackTypeById = new Map(attackTypes.map((a) => [a.id, a]))

  const failedAttacks = vulnerableResults.map((r) => {
    const at = attackTypeById.get(r.attackTypeId)
    return {
      technique: `${at?.name ?? 'Unknown attack'} — ${r.technique}`,
      payload: r.payload,
      response: r.response,
      evidence: r.evidence,
    }
  })

  // 2. Call the hardening LLM.
  const originalTarget = originalScan.target
  const hardenedPrompt = await hardenPrompt(
    originalTarget.systemPrompt,
    failedAttacks,
  )

  // 3. Create the new Target row (same userId, version+1, parent=original).
  const nextVersion = originalTarget.version + 1
  const hardenedTarget: Target = await db.target.create({
    data: {
      userId,
      name: `${originalTarget.name} (hardened v${nextVersion})`,
      systemPrompt: hardenedPrompt,
      context: originalTarget.context,
      mode: originalTarget.mode,
      apiEndpoint: originalTarget.apiEndpoint,
      apiHeaders: originalTarget.apiHeaders,
      apiModel: originalTarget.apiModel,
      parentId: originalTarget.id,
      version: nextVersion,
    },
  })

  // 4. Create a new Scan for the hardened target.
  const allAttackTypes: AttackTypeRow[] = await db.attackType.findMany()
  const hardenedScan: Scan = await db.scan.create({
    data: {
      userId,
      targetId: hardenedTarget.id,
      status: 'running',
      note: `Hardened re-test of scan ${scanId}`,
    },
  })

  // 5. Run the full scan against the hardened target.
  const scanTarget: ScanTarget = {
    id: hardenedTarget.id,
    systemPrompt: hardenedTarget.systemPrompt,
    context: hardenedTarget.context,
  }
  await runScan(hardenedScan.id, scanTarget, allAttackTypes, db)

  // Reload both scans with their results.
  const refreshedOriginal = await db.scan.findUnique({
    where: { id: scanId },
    include: { results: true },
  })
  const refreshedHardened = await db.scan.findUnique({
    where: { id: hardenedScan.id },
    include: { results: true },
  })
  if (!refreshedOriginal || !refreshedHardened) {
    throw new Error('Failed to reload scans after hardening.')
  }

  return {
    originalScan: refreshedOriginal,
    hardenedTarget,
    hardenedScan: refreshedHardened,
  }
}

/**
 * Phase 1 of harden: just create the hardened target + running scan row.
 * Returns the IDs so the API can return immediately and the background job
 * can pick up the scan.
 */
export async function createHardenTarget(
  scanId: string,
  userId: string,
  db: PrismaClient,
): Promise<{ hardenedTargetId: string; hardenedScanId: string }> {
  const originalScan = await db.scan.findFirst({
    where: { id: scanId, userId },
    include: {
      target: true,
      results: true,
    },
  })
  if (!originalScan) {
    throw new Error(`Scan ${scanId} not found.`)
  }
  if (!originalScan.target) {
    throw new Error(`Scan ${scanId} has no target.`)
  }

  const vulnerableResults = originalScan.results.filter((r) => r.success)
  if (vulnerableResults.length === 0) {
    throw new Error(
      `Scan ${scanId} has no successful attacks — nothing to harden against.`,
    )
  }

  const attackTypeIds = Array.from(
    new Set(vulnerableResults.map((r) => r.attackTypeId)),
  )
  const attackTypes: AttackType[] = await db.attackType.findMany({
    where: { id: { in: attackTypeIds } },
  })
  const attackTypeById = new Map(attackTypes.map((a) => [a.id, a]))

  const failedAttacks = vulnerableResults.map((r) => {
    const at = attackTypeById.get(r.attackTypeId)
    return {
      technique: `${at?.name ?? 'Unknown attack'} — ${r.technique}`,
      payload: r.payload,
      response: r.response,
      evidence: r.evidence,
    }
  })

  const originalTarget = originalScan.target
  const hardenedPrompt = await hardenPrompt(
    originalTarget.systemPrompt,
    failedAttacks,
  )

  const nextVersion = originalTarget.version + 1
  const hardenedTarget: Target = await db.target.create({
    data: {
      userId,
      name: `${originalTarget.name} (hardened v${nextVersion})`,
      systemPrompt: hardenedPrompt,
      context: originalTarget.context,
      mode: originalTarget.mode,
      apiEndpoint: originalTarget.apiEndpoint,
      apiHeaders: originalTarget.apiHeaders,
      apiModel: originalTarget.apiModel,
      parentId: originalTarget.id,
      version: nextVersion,
    },
  })

  const hardenedScan: Scan = await db.scan.create({
    data: {
      userId,
      targetId: hardenedTarget.id,
      status: 'running',
      note: `Hardened re-test of scan ${scanId}`,
    },
  })

  return { hardenedTargetId: hardenedTarget.id, hardenedScanId: hardenedScan.id }
}
