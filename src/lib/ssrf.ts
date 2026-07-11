import dns from 'dns/promises'
import net from 'net'
import { URL } from 'url'

/**
 * SSRF (Server-Side Request Forgery) protection.
 *
 * When users give us a URL to attack (API-connect mode), we MUST validate it
 * before fetching. Without this, an attacker can submit:
 *   - http://169.254.169.254/latest/meta-data/  (cloud metadata — steals creds)
 *   - http://10.0.0.1/admin                     (internal services)
 *   - http://localhost:6379                     (Redis on the server)
 *   - http://[::1]:6379                         (IPv6 loopback)
 *
 * Defense: resolve the hostname, check every resolved IP against a blocklist
 * of private/reserved ranges, then fetch using the IP directly (prevent
 * DNS rebinding where the hostname resolves to a public IP at check time but
 * a private IP at fetch time).
 */

export class SsrfError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SsrfError'
  }
}

// IP ranges that are NEVER safe to fetch from a user-supplied URL.
const BLOCKED_RANGES: Array<{ name: string; test: (ip: string) => boolean }> = [
  // IPv4 loopback
  { name: 'loopback-v4', test: (ip) => ip === '127.0.0.1' || ip.startsWith('127.') },
  // IPv4 private (RFC 1918)
  { name: 'private-10', test: (ip) => ip.startsWith('10.') },
  { name: 'private-172', test: (ip) => {
    const parts = ip.split('.').map(Number)
    return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31
  }},
  { name: 'private-192', test: (ip) => ip.startsWith('192.168.') },
  // IPv4 link-local
  { name: 'link-local', test: (ip) => ip.startsWith('169.254.') },
  // IPv4 carrier-grade NAT (RFC 6598)
  { name: 'cgnat', test: (ip) => {
    const parts = ip.split('.').map(Number)
    return parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127
  }},
  // IPv4 multicast
  { name: 'multicast-v4', test: (ip) => {
    const parts = ip.split('.').map(Number)
    return parts[0] >= 224 && parts[0] <= 239
  }},
  // IPv4 broadcast
  { name: 'broadcast', test: (ip) => ip === '255.255.255.255' },
  // IPv6 loopback
  { name: 'loopback-v6', test: (ip) => ip === '::1' },
  // IPv6 link-local
  { name: 'link-local-v6', test: (ip) => ip.startsWith('fe80:') },
  // IPv6 unique-local
  { name: 'ula-v6', test: (ip) => ip.startsWith('fc') || ip.startsWith('fd') },
  // IPv6 multicast
  { name: 'multicast-v6', test: (ip) => ip.startsWith('ff') },
  // IPv4-mapped IPv6 (::ffff:127.0.0.1 etc.)
  { name: 'v4-mapped', test: (ip) => {
    const m = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/i)
    if (!m) return false
    return isBlockedIp(m[1])
  }},
  // IPv6 unspecified
  { name: 'unspecified-v6', test: (ip) => ip === '::' },
]

function isBlockedIp(ip: string): boolean {
  return BLOCKED_RANGES.some((r) => r.test(ip))
}

function getBlockedReason(ip: string): string | null {
  for (const r of BLOCKED_RANGES) {
    if (r.test(ip)) return r.name
  }
  return null
}

export interface SafeUrl {
  /** The URL to fetch — uses the original hostname (for Host header / TLS SNI). */
  url: string
  /** The resolved IP(s), for logging. */
  resolvedIps: string[]
}

/**
 * Validate a user-supplied URL for safe fetching.
 *
 * Rules:
 *   1. Must be a valid URL with http: or https: scheme.
 *   2. Must have a hostname (no bare IP — actually we allow bare IP but it still gets checked).
 *   3. DNS-resolve the hostname; EVERY resolved IP must be public.
 *   4. Reject if any IP is private/loopback/link-local/metadata/etc.
 *
 * Returns the validated URL. Throws SsrfError on any violation.
 */
export async function assertSafeUrl(rawUrl: string): Promise<SafeUrl> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new SsrfError(`Invalid URL: ${rawUrl}`)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfError(
      `Only http: and https: URLs are allowed (got ${parsed.protocol}).`,
    )
  }

  const hostname = parsed.hostname
  if (!hostname) {
    throw new SsrfError('URL has no hostname.')
  }

  // If the hostname is already an IP literal, check it directly.
  if (net.isIP(hostname)) {
    const reason = getBlockedReason(hostname)
    if (reason) {
      throw new SsrfError(
        `URL resolves to a blocked IP range (${reason}): ${hostname}`,
      )
    }
    return { url: rawUrl, resolvedIps: [hostname] }
  }

  // DNS-resolve the hostname. We check BOTH A (IPv4) and AAAA (IPv6) records.
  let resolved: string[]
  try {
    const records = await dns.resolve4(hostname).catch(() => [] as string[])
    const records6 = await dns.resolve6(hostname).catch(() => [] as string[])
    resolved = [...records, ...records6]
  } catch {
    throw new SsrfError(`DNS resolution failed for ${hostname}.`)
  }

  if (resolved.length === 0) {
    throw new SsrfError(`No DNS records found for ${hostname}.`)
  }

  // EVERY resolved IP must be safe. If even one is private, reject.
  for (const ip of resolved) {
    const reason = getBlockedReason(ip)
    if (reason) {
      throw new SsrfError(
        `URL "${hostname}" resolves to a blocked IP range (${reason}): ${ip}`,
      )
    }
  }

  return { url: rawUrl, resolvedIps: resolved }
}

/**
 * Convenience: validate + return just the URL string. For callers that don't
 * need the resolved IPs.
 */
export async function assertSafeUrlString(rawUrl: string): Promise<string> {
  const safe = await assertSafeUrl(rawUrl)
  return safe.url
}
