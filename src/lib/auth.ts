import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from '@/lib/db'

// Simple in-memory rate limiter for admin login (brute force protection).
// Tracks attempts per IP. 5 attempts per 15 minutes.
const adminLoginAttempts = new Map<string, { count: number; resetAt: number }>()
const ADMIN_RATE_LIMIT = { maxAttempts: 5, windowMs: 15 * 60 * 1000 }

function checkAdminRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = adminLoginAttempts.get(ip)
  if (!entry || now > entry.resetAt) {
    adminLoginAttempts.set(ip, { count: 1, resetAt: now + ADMIN_RATE_LIMIT.windowMs })
    return true
  }
  if (entry.count >= ADMIN_RATE_LIMIT.maxAttempts) {
    return false
  }
  entry.count++
  return true
}

/**
 * NextAuth v5 (Auth.js) configuration.
 *
 * Providers:
 *   - GitHub OAuth (always)
 *   - Google OAuth (always)
 *   - Admin credentials (always — but only works with ADMIN_API_KEY)
 *   - Dev test credentials (DEV ONLY — bypasses OAuth for local testing)
 *
 * Admin login: POST to /api/auth/callback/credentials with
 * { email: "admin", password: ADMIN_API_KEY } — the authorize function
 * checks the key and creates/signs in an admin user.
 */
const providers = [
  GitHub({
    clientId: process.env.GITHUB_ID,
    clientSecret: process.env.GITHUB_SECRET,
  }),
  Google({
    clientId: process.env.GOOGLE_ID,
    clientSecret: process.env.GOOGLE_SECRET,
  }),

  // Admin login — always available, but only works with the correct key.
  // This lets you log in as admin in production without OAuth.
  Credentials({
    id: 'admin',
    name: 'Admin',
    credentials: {
      password: { label: 'Admin Key', type: 'password' },
    },
    async authorize(credentials, req) {
      const adminKey = process.env.ADMIN_API_KEY
      if (!adminKey) return null // admin login disabled

      // Rate limit: 5 attempts per 15 minutes per IP
      const ip = req?.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() ||
        req?.headers?.get?.('x-real-ip') || 'unknown'
      if (!checkAdminRateLimit(ip)) {
        return null // rate limited — silently fail (don't reveal why)
      }

      const key = (credentials?.password as string)?.trim()
      if (!key || key !== adminKey) return null

      // Find or create the admin user.
      const adminEmail = 'admin@redline.local'
      let user = await db.user.findUnique({ where: { email: adminEmail } })
      if (!user) {
        user = await db.user.create({
          data: {
            email: adminEmail,
            name: 'Admin',
            isAdmin: true,
            plan: 'team',
          },
        })
      } else if (!user.isAdmin) {
        user = await db.user.update({
          where: { id: user.id },
          data: { isAdmin: true, plan: 'team' },
        })
      }
      return user
    },
  }),
]

// Dev-only: add a test credentials provider so we can test without real OAuth.
// This is NEVER available in production.
if (process.env.NODE_ENV !== 'production') {
  providers.push(
    Credentials({
      id: 'dev-test',
      name: 'Dev Test User',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'test@redline.dev' },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string)?.trim() || 'test@redline.dev'
        let user = await db.user.findUnique({ where: { email } })
        if (!user) {
          user = await db.user.create({
            data: {
              email,
              name: email === 'test@redline.dev' ? 'Test User' : email.split('@')[0],
            },
          })
        }
        return user
      },
    }),
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: {
    strategy: 'jwt',
  },
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  // Secure cookies in production (HTTPS only, SameSite=Lax)
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id
        // Persist admin flag on the JWT.
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { isAdmin: true },
        })
        if (dbUser?.isAdmin) {
          token.isAdmin = true
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        ;(session.user as { id?: string; isAdmin?: boolean }).id = token.id as string
        ;(session.user as { id?: string; isAdmin?: boolean }).isAdmin =
          (token.isAdmin as boolean) ?? false
      }
      return session
    },
  },
})

export default auth
