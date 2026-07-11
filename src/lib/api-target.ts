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
 * and most custom wrappers.
 *
 * SSRF protection: the endpoint URL is validated via assertSafeUrl before
 * every fetch. This blocks private IPs, cloud metadata, loopback, etc.
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

/**
 * Call the user's endpoint with a single-turn conversation (system + user).
 * Returns the assistant's response text.
 *
 * Throws on network errors, non-2xx responses, or SSRF violations.
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
      // If the user gave us bad JSON, ignore it (don't crash the scan).
      console.warn('[api-target] ignoring invalid headers JSON:', config.headersJson)
    }
  }

  const body = JSON.stringify({
    model: config.model || 'gpt-4o-mini',
    messages: turns,
    // Don't stream — we want the full response.
    stream: false,
  })

  // Fetch with a timeout (30s). If the user's endpoint is slow, we fail this
  // payload but the scan continues.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const res = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body,
      signal: controller.signal,
      // Never follow redirects — a redirect to an internal IP is an SSRF vector.
      redirect: 'manual',
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
  } finally {
    clearTimeout(timeout)
  }
}
