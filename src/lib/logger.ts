/**
 * Structured JSON logger.
 *
 * Outputs one JSON object per log line — easy to ship to Axiom, Logflare,
 * Datadog, or any log aggregator that ingests JSON.
 *
 * In development, logs are pretty-printed for readability.
 * In production, logs are compact JSON (one line per entry).
 *
 * Log levels (in order of severity):
 *   debug → info → warn → error
 *
 * Usage:
 *   logger.info('scan.started', { scanId, targetId, userId })
 *   logger.error('llm.call_failed', { error: err.message, attempt })
 *   logger.warn('rate_limited', { userId, retryAfter })
 *
 * To ship to a log aggregator in production:
 *   1. Set LOG_DESTINATION=axiom (or logflare, datadog, etc.)
 *   2. Set LOG_API_TOKEN=your-token
 *   3. The `transport` function below would be swapped to POST to the service
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  [key: string]: unknown
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

// Minimum level to log (configurable via env).
const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL]
}

function formatEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'production') {
    // Compact JSON for log aggregators.
    return JSON.stringify(entry)
  }
  // Pretty-printed for dev.
  const { level, message, timestamp, ...rest } = entry
  const meta = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : ''
  const color = {
    debug: '\x1b[90m',
    info: '\x1b[36m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
  }[level]
  const reset = '\x1b[0m'
  return `${color}[${level.toUpperCase()}]${reset} ${message}${meta}`
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  }

  const formatted = formatEntry(entry)

  // In production, everything goes to stdout (Vercel/ Railway capture it).
  // Errors also go to stderr.
  if (level === 'error') {
    console.error(formatted)
  } else if (level === 'warn') {
    console.warn(formatted)
  } else {
    console.log(formatted)
  }

  // TODO: When LOG_DESTINATION is set, POST the entry to the log aggregator.
  // This would be an async fire-and-forget call (don't block the request).
  // For now, we just use console.
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    log('debug', message, meta)
  },
  info(message: string, meta?: Record<string, unknown>) {
    log('info', message, meta)
  },
  warn(message: string, meta?: Record<string, unknown>) {
    log('warn', message, meta)
  },
  error(message: string, meta?: Record<string, unknown>) {
    log('error', message, meta)
  },

  /**
   * Create a child logger with a persistent context (e.g. scanId).
   * All subsequent calls automatically include the context.
   *
   *   const scanLog = logger.child({ scanId, targetId })
   *   scanLog.info('scan.started')
   *   scanLog.error('scan.failed', { error: err.message })
   */
  child(context: Record<string, unknown>) {
    return {
      debug: (message: string, meta?: Record<string, unknown>) =>
        log('debug', message, { ...context, ...meta }),
      info: (message: string, meta?: Record<string, unknown>) =>
        log('info', message, { ...context, ...meta }),
      warn: (message: string, meta?: Record<string, unknown>) =>
        log('warn', message, { ...context, ...meta }),
      error: (message: string, meta?: Record<string, unknown>) =>
        log('error', message, { ...context, ...meta }),
    }
  },
}

export default logger
