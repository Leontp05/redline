/* eslint-disable @typescript-eslint/no-require-imports */
const core = require('@actions/core')
const github = require('@actions/github')

/**
 * Redline GitHub Action.
 *
 * Runs a security scan against an LLM system prompt and fails the build
 * if the score is below a threshold.
 *
 * Flow:
 *   1. Create a target (or use an existing target-id)
 *   2. Start a scan
 *   3. Poll until complete (or timeout)
 *   4. Check the score against min-score
 *   5. Fail the build if below threshold (or if fail-on-vulnerable is set)
 */

const DEFAULT_API_URL = 'https://redline-orcin.vercel.app'
const POLL_INTERVAL_MS = 3000 // 3 seconds

async function main() {
  try {
    const apiKey = core.getInput('api-key', { required: true })
    const systemPrompt = core.getInput('system-prompt')
    const targetId = core.getInput('target-id')
    const targetName = core.getInput('target-name') || 'CI/CD Scan'
    const apiUrl = core.getInput('api-url') || DEFAULT_API_URL
    const minScore = parseInt(core.getInput('min-score') || '50', 10)
    const failOnVulnerable = core.getInput('fail-on-vulnerable') === 'true'
    const timeoutMinutes = parseInt(core.getInput('timeout-minutes') || '5', 10)

    if (!systemPrompt && !targetId) {
      throw new Error('Either "system-prompt" or "target-id" is required.')
    }

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }

    core.info(`🔴 Redline — AI Security Scan`)
    core.info(`   API: ${apiUrl}`)
    core.info(`   Min score: ${minScore}`)
    core.info(`   Fail on vulnerable: ${failOnVulnerable}`)
    core.info('')

    // ─── Step 1: Resolve target ───
    let scanTargetId = targetId

    if (!scanTargetId) {
      core.info(`Creating target "${targetName}"...`)
      const createRes = await fetch(`${apiUrl}/api/v1/targets`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: targetName,
          systemPrompt,
        }),
      })

      if (!createRes.ok) {
        const err = await createRes.text()
        throw new Error(`Failed to create target (${createRes.status}): ${err}`)
      }

      const target = await createRes.json()
      scanTargetId = target.target.id
      core.info(`✓ Target created: ${scanTargetId}`)
    } else {
      core.info(`Using existing target: ${scanTargetId}`)
    }

    // ─── Step 2: Start scan ───
    core.info('')
    core.info('Starting scan...')
    const scanRes = await fetch(`${apiUrl}/api/v1/scans`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetId: scanTargetId }),
    })

    if (!scanRes.ok) {
      const err = await scanRes.text()
      throw new Error(`Failed to start scan (${scanRes.status}): ${err}`)
    }

    const scan = await scanRes.json()
    const scanId = scan.scan.id
    core.info(`✓ Scan started: ${scanId}`)

    // ─── Step 3: Poll until complete ───
    core.info('')
    core.info('Waiting for scan to complete (this takes ~30-60 seconds)...')

    const deadline = Date.now() + timeoutMinutes * 60 * 1000
    let pollCount = 0
    let scanData = null

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      pollCount++

      const pollRes = await fetch(`${apiUrl}/api/v1/scans/${scanId}`, { headers })
      if (!pollRes.ok) continue

      scanData = await pollRes.json()
      const status = scanData.scan.status

      if (status === 'complete') {
        break
      } else if (status === 'failed') {
        throw new Error(`Scan failed. Check the Redline dashboard for details.`)
      }

      // Still running — show progress
      const results = scanData.scan.results?.length || 0
      core.info(`  ...still scanning (${results} payloads completed)`)
    }

    if (!scanData || scanData.scan.status === 'running') {
      throw new Error(`Scan timed out after ${timeoutMinutes} minutes.`)
    }

    // ─── Step 4: Report results ───
    const score = scanData.scan.overallScore
    const results = scanData.scan.results || []
    const vulnerableCount = results.filter((r) => r.success).length
    const totalCount = results.length
    const reportUrl = `${apiUrl.replace(/\/$/, '')}/app?scan=${scanId}`

    core.info('')
    core.info('═══════════════════════════════════════')
    core.info('  🔴 Redline Scan Complete')
    core.info('═══════════════════════════════════════')
    core.info(`  Score:      ${score ?? '—'}/100`)
    core.info(`  Vulnerable: ${vulnerableCount} / ${totalCount}`)
    core.info(`  Report:     ${reportUrl}`)
    core.info('═══════════════════════════════════════')
    core.info('')

    // Set outputs
    core.setOutput('scan-id', scanId)
    core.setOutput('score', String(score ?? ''))
    core.setOutput('vulnerable-count', String(vulnerableCount))
    core.setOutput('total-count', String(totalCount))
    core.setOutput('report-url', reportUrl)

    // ─── Step 5: Check threshold ───
    let shouldFail = false
    let failReason = ''

    if (failOnVulnerable && vulnerableCount > 0) {
      shouldFail = true
      failReason = `${vulnerableCount} vulnerabilit${vulnerableCount === 1 ? 'y' : 'ies'} found`
    } else if (score != null && score < minScore) {
      shouldFail = true
      failReason = `score ${score} is below threshold ${minScore}`
    }

    if (shouldFail) {
      core.setFailed(
        `❌ Redline scan failed: ${failReason}.\n` +
          `   Score: ${score ?? '—'}/100 (min: ${minScore})\n` +
          `   Vulnerable: ${vulnerableCount}/${totalCount}\n` +
          `   Report: ${reportUrl}`,
      )
    } else {
      core.info(`✅ Scan passed — score ${score ?? '—'}/100 ≥ ${minScore}`)
    }

    // Add a PR comment if running in a PR context (optional, non-blocking)
    if (github.context.payload.pull_request) {
      try {
        const token = process.env.GITHUB_TOKEN
        if (token) {
          const octokit = github.getOctokit(token)
          const { owner, repo } = github.context.repo
          const prNumber = github.context.payload.pull_request.number

          const scoreEmoji = score >= 80 ? '🟢' : score >= 50 ? '🟡' : '🔴'
          const status = shouldFail ? '❌ Failed' : '✅ Passed'

          const body = [
            `### ${scoreEmoji} Redline Security Scan — ${status}`,
            '',
            `| Metric | Value |`,
            `|--------|-------|`,
            `| Score | **${score ?? '—'}/100** |`,
            `| Vulnerable | ${vulnerableCount} / ${totalCount} |`,
            `| Threshold | ${minScore} |`,
            `| Report | [View Full Report →](${reportUrl}) |`,
            '',
            shouldFail
              ? `> ⚠️ **${failReason}**. Harden your system prompt and re-run.`
              : `> ✅ Security score meets the threshold.`,
          ].join('\n')

          await octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: prNumber,
            body,
          })
        }
      } catch (commentErr) {
        // Non-blocking — the scan result is what matters
        core.warning(`Failed to add PR comment: ${commentErr.message}`)
      }
    }
  } catch (err) {
    core.setFailed(`Redline scan error: ${err.message}`)
  }
}

main()
