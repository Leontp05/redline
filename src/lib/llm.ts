import OpenAI from 'openai'

/**
 * LLM wrapper for the Redline platform.
 *
 * Uses Groq (primary) + Google Gemini (fallback) — both have generous free
 * tiers and are OpenAI-compatible.
 *
 * The LLM is used in two roles:
 *   1. As the *target model* — simulates "their app" given a system prompt.
 *   2. As the *hardening model* — rewrites prompts to close detected gaps.
 *
 * CRITICAL: This module is server-only. It must never be imported from client
 * components. API route handlers in `src/app/api/**` import these functions
 * and they all run with `runtime = 'nodejs'`.
 *
 * ─────────────────────────────────────────────
 * ENV VARS (set at least one provider):
 * ─────────────────────────────────────────────
 *
 * Groq (primary — fast, free tier: 30 req/min, 1000 req/day):
 *   GROQ_API_KEY=gsk_xxx
 *   GROQ_MODEL=llama-3.3-70b-versatile   (or llama-3.1-8b-instant for speed)
 *
 * Google Gemini (fallback — free tier: 15 req/min, 1500 req/day):
 *   GEMINI_API_KEY=xxx
 *   GEMINI_MODEL=gemini-1.5-flash
 *
 * Get free keys:
 *   Groq:   https://console.groq.com/keys
 *   Gemini: https://aistudio.google.com/apikey
 *
 * If neither is set, the LLM calls fail gracefully (returns an error string,
 * the scan records [ERROR] for that payload and moves on — it doesn't crash).
 */

type ChatTurn = { role: 'user' | 'assistant'; content: string }

interface LLMProvider {
  name: string
  client: OpenAI
  model: string
}

let providers: LLMProvider[] | null = null

/**
 * Build the list of configured LLM providers, in priority order.
 * Groq is tried first (faster), then Gemini (fallback).
 */
function getProviders(): LLMProvider[] {
  if (providers) return providers

  const list: LLMProvider[] = []

  // Groq (primary)
  if (process.env.GROQ_API_KEY) {
    list.push({
      name: 'groq',
      client: new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
      }),
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    })
  }

  // Gemini (fallback) — OpenAI-compatible endpoint
  if (process.env.GEMINI_API_KEY) {
    list.push({
      name: 'gemini',
      client: new OpenAI({
        apiKey: process.env.GEMINI_API_KEY,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      }),
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    })
  }

  providers = list
  return list
}

/**
 * Call the LLM with a single-turn conversation (system + user message).
 * Returns the assistant's response text.
 *
 * Tries providers in order. If one fails (rate limit, network error, etc.),
 * falls back to the next. If all fail, returns "[ERROR] ...".
 */
export async function callTargetModel(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const providerList = getProviders()

  if (providerList.length === 0) {
    return '[ERROR] No LLM provider configured. Set GROQ_API_KEY or GEMINI_API_KEY.'
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]

  for (const provider of providerList) {
    try {
      const completion = await provider.client.chat.completions.create({
        model: provider.model,
        messages,
        // Disable "thinking" mode — we want fast, direct responses.
        // (OpenAI-compatible param, ignored by some providers.)
        stream: false,
      })
      const content = completion.choices?.[0]?.message?.content
      if (content && typeof content === 'string') {
        return content
      }
      // Empty response — try next provider
      console.warn(`[llm] ${provider.name} returned empty content, trying next`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[llm] ${provider.name} failed: ${msg}, trying next provider`)
      // Continue to next provider
    }
  }

  return '[ERROR] All LLM providers failed. Check API keys and rate limits.'
}

/**
 * Call the LLM with a full conversation history (multi-turn).
 * Used by the crescendo multi-turn attack.
 */
export async function callTargetModelMultiTurn(
  systemPrompt: string,
  turns: ChatTurn[],
): Promise<string> {
  const providerList = getProviders()

  if (providerList.length === 0) {
    return '[ERROR] No LLM provider configured. Set GROQ_API_KEY or GEMINI_API_KEY.'
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...turns.map((t) => ({
      role: t.role as 'user' | 'assistant',
      content: t.content,
    })),
  ]

  for (const provider of providerList) {
    try {
      const completion = await provider.client.chat.completions.create({
        model: provider.model,
        messages,
        stream: false,
      })
      const content = completion.choices?.[0]?.message?.content
      if (content && typeof content === 'string') {
        return content
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[llm:multi] ${provider.name} failed: ${msg}, trying next`)
    }
  }

  return '[ERROR] All LLM providers failed (multi-turn). Check API keys and rate limits.'
}

/**
 * Harden a system prompt using the LLM.
 *
 * Feeds the original prompt + all successful attacks to the LLM, asks it to
 * rewrite the prompt to close the gaps while preserving original functionality.
 */
export async function hardenPrompt(
  originalPrompt: string,
  failedAttacks: Array<{
    technique: string
    payload: string
    response: string
    evidence: string
  }>,
): Promise<string> {
  const providerList = getProviders()

  if (providerList.length === 0) {
    throw new Error(
      'No LLM provider configured. Set GROQ_API_KEY or GEMINI_API_KEY to enable hardening.',
    )
  }

  const attacksSummary = failedAttacks
    .map(
      (a, i) =>
        `Attack ${i + 1}: ${a.technique}\n  Payload: ${a.payload.slice(0, 200)}...\n  Model response: ${a.response.slice(0, 200)}...\n  Evidence: ${a.evidence}`,
    )
    .join('\n\n')

  const systemMessage = `You are a prompt security engineer. Your job is to rewrite LLM system prompts to close security vulnerabilities while preserving the original functionality.

You will receive:
1. An original system prompt
2. A list of attacks that successfully breached it

Rewrite the system prompt to defend against ALL the listed attacks. The rewritten prompt must:
- Preserve the original functionality and tone
- Add explicit defenses against the specific attack techniques that worked
- NOT just add generic "do not comply with jailbreaks" boilerplate — be specific
- Be concise and clear

Output ONLY the rewritten system prompt. No explanations, no preamble, no markdown fences.`

  const userMessage = `ORIGINAL SYSTEM PROMPT:
${originalPrompt}

SUCCESSFUL ATTACKS (${failedAttacks.length}):
${attacksSummary}

Rewrite the system prompt to defend against these attacks:`

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemMessage },
    { role: 'user', content: userMessage },
  ]

  for (const provider of providerList) {
    try {
      const completion = await provider.client.chat.completions.create({
        model: provider.model,
        messages,
        stream: false,
        // Slightly lower temperature for more focused output
        temperature: 0.3,
      })
      const content = completion.choices?.[0]?.message?.content
      if (content && typeof content === 'string') {
        // Strip any markdown code fences if the model added them
        return content
          .replace(/^```(?:[a-z]*)?\n?/i, '')
          .replace(/\n?```$/i, '')
          .replace(/^Here is the rewritten system prompt:?\s*/i, '')
          .trim()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[llm:harden] ${provider.name} failed: ${msg}, trying next`)
    }
  }

  throw new Error('All LLM providers failed during hardening. Check API keys and rate limits.')
}
