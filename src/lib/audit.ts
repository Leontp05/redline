import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

/**
 * Audit logging helper.
 *
 * Every security-relevant action (scan creation, hardening, target deletion,
 * auth events) gets a row in AuditEvent. This is mandatory for a security
 * product — needed for abuse response, billing disputes, and compliance.
 *
 * Usage:
 *   await logAudit(userId, 'scan.create', `scan:${scanId}`, req)
 */
export async function logAudit(
  userId: string,
  action: string,
  target?: string | null,
  req?: NextRequest | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.auditEvent.create({
      data: {
        userId,
        action,
        target: target ?? null,
        ip:
          req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          req?.headers.get('x-real-ip') ??
          null,
        userAgent: req?.headers.get('user-agent') ?? null,
        meta: meta ? JSON.stringify(meta) : null,
      },
    })
  } catch (err) {
    // Audit logging must never break the main request flow.
    console.error('[audit] failed to log event:', action, err)
  }
}
