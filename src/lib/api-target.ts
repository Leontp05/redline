import { assertSafeUrl } from './ssrf'

/**
 * Call a user's live LLM endpoint (API-connect mode).
 *
 * Supports the OpenAI chat-completions format — the de-facto standard:
 *   POST {endpoint}
 *   Headers: { Authorization: "Bearer <key>", ...userHeaders }
 *   Body: { model, messages: [{role, content}] }
 *   Response: { choices: [{message: {content}}] }
 *
 * This covers OpenAI, Azure, Anthropic-via-proxy, Ollama, vLLM, LM Studio,
 * Groq, Together AI, and most custom wrappers.
 *
 * SSRF protection: the endpoint URL is validated via assertSafeUrl before
 * every fetch. This blocks private IPs, cloud metadata, loopback, etc.
 *
 * Rate limit handling: if the endpoint returns 429, we retry with
 * exponential backoff (up to 3 retries). This is critical for free-tier
 * providers like Groq (30 req/min) where a 40-payload scan can hit limits.
 */

export interface ApiTargetConfig {
  endpoint: string
  /** JSON string of additional headers (may include Authorization). */
  headersJson: string | null
  /** Model name (e.g. "gpt-4o", "claude-3-5-sonnet", "llama3"). */
  model: string | null
}

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Sleep helper for delays between retries. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Make a single fetch to the endpoint, with retry on 429 (rate limit).
 * Max 3 retries with exponential backoff: 2s, 4s, 8s.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)

    try {
      const res = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(timeout)

      // If rate-limited, wait and retry
      if (res.status === 429 && attempt < maxRetries) {
        const waitMs = Math.pow(2, attempt + 1) * 1000 // 2s, 4s, 8s
        // Check for Retry-After header
        const retryAfter = res.headers.get('retry-after')
        const wait = retryAfter ? parseInt(retryAfter, 10) * 1000 : waitMs
        await sleep(Math.min(wait, 30_000)) // cap at 30s
        continue
      }

      return res
    } catch (err) {
      clearTimeout(timeout)
      if (attempt < maxRetries) {
        await sleep(Math.pow(2, attempt + 1) * 1000)
        continue
      }
      throw err
    }
  }
  // Should not reach here, but TypeScript needs it
  throw new Error('Max retries exceeded')
}

/**
 * Call the user's endpoint with a single-turn conversation (system + user).
 */
export async function callTargetApi(
  config: ApiTargetConfig,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const messages: ChatTurn[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]
  return callTargetApiMultiTurn(config, messages)
}

/**
 * Call the user's endpoint with a full conversation history (multi-turn).
 */
export async function callTargetApiMultiTurn(
  config: ApiTargetConfig,
  turns: ChatTurn[],
): Promise<string> {
  // SSRF check — resolve + validate before we connect.
  await assertSafeUrl(config.endpoint)

  // Parse user-supplied headers.
  let extraHeaders: Record<string, string> = {}
  if (config.headersJson) {
    try {
      const parsed = JSON.parse(config.headersJson)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        extraHeaders = parsed as Record<string, string>
      }
    } catch {
      console.warn('[api-target] ignoring invalid headers JSON:', config.headersJson)
    }
  }

  const body = JSON.stringify({
    model: config.model || 'gpt-4o-mini',
    messages: turns,
    stream: false,
  })

  const res = await fetchWithRetry(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body,
    redirect: 'error',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Target API returned ${res.status} ${res.statusText}: ${text.slice(0, 200)}`,
    )
  }

  const data = await res.json().catch(() => null) as
    | { choices?: Array<{ message?: { content?: string } }> }
    | null

  const content = data?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') {
    throw new Error(
      'Target API response missing choices[0].message.content — is this an OpenAI-compatible endpoint?',
    )
  }
  return content
}
