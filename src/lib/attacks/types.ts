/**
 * Attack module type definitions.
 *
 * An `AttackModule` represents a category of adversarial technique
 * (jailbreak, injection, encoding, etc.). Each module ships a static list of
 * `payloads` (specific variants of the technique) and a `run` function that
 * executes a single payload against a target via an `AttackExecutor`.
 */

export interface AttackPayload {
  /** Specific variant name, e.g. "DAN persona" or "base64 wrap". */
  technique: string
  /** The user message to send to the target model. */
  payload: string
  /**
   * Optional — replace the target's `context` field for this payload only.
   * Used by the injection attack, which smuggles hidden instructions inside
   * fake "retrieved documents".
   */
  contextOverride?: string
}

export interface AttackRunResult {
  /** The final model response. */
  response: string
  /**
   * Full conversation turns (for multi-turn attacks). Stored as JSON on the
   * Result row so the UI can replay it.
   */
  conversation?: { role: 'user' | 'assistant'; content: string }[]
}

export interface AttackExecutor {
  run(
    targetSystemPrompt: string,
    targetContext: string | null,
    payload: AttackPayload
  ): Promise<AttackRunResult>
}

export interface AttackTarget {
  systemPrompt: string
  context: string | null
}

export interface AttackModule {
  /** Stable key, matches AttackType.key in DB (e.g. "roleplay"). */
  key: string
  /** Human-readable name, e.g. "Roleplay/Persona Jailbreak". */
  name: string
  /** One of: jailbreak | injection | encoding | multi-turn | extraction. */
  category: string
  /** 1-10 — higher = more severe if it succeeds. Used in scoring. */
  severityWeight: number
  description: string
  /** Static list of payload variants. */
  payloads: AttackPayload[]
  /**
   * Execute one payload against the target via the executor. Returns the
   * model's final response (and optional full conversation for multi-turn).
   */
  run: (
    executor: AttackExecutor,
    target: AttackTarget,
    payload: AttackPayload
  ) => Promise<AttackRunResult>
}
