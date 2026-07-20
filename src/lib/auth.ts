import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

/**
 * NextAuth v5 (Auth.js) configuration.
 *
 * Providers:
 *   - GitHub OAuth
 *   - Google OAuth
 *   - Credentials (username + password — signup AND login)
 *   - Admin (hidden — accessed via /api/auth/callback/credentials with provider "admin")
 *
 * Admin login is NOT shown on the login page. Access it by navigating to
 * /app?admin=true which reveals the admin key input.
 */

// ─── Admin rate limiter ───
const adminLoginAttempts = new Map<string, { count: number; resetAt: number }>()
const ADMIN_RATE_LIMIT = { maxAttempts: 5, windowMs: 15 * 60 * 1000 }

function checkAdminRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = adminLoginAttempts.get(ip)
  if (!entry || now > entry.resetAt) {
    adminLoginAttempts.set(ip, { count: 1, resetAt: now + ADMIN_RATE_LIMIT.windowMs })
    return true
  }
  if (entry.count >= ADMIN_RATE_LIMIT.maxAttempts) return false
  entry.count++
  return true
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: {
    strategy: 'jwt',
  },
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  // Secure cookies in production
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
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Google({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),

    // Username + password credentials (for signup AND login)
    Credentials({
      id: 'credentials',
      name: 'Username & Password',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
        mode: { label: 'Mode', type: 'text' }, // "login" or "signup"
      },
      async authorize(credentials) {
        const username = (credentials?.username as string)?.trim().toLowerCase()
        const password = (credentials?.password as string)?.trim()
        const mode = (credentials?.mode as string) || 'login'

        if (!username) return null

        // SIGNUP MODE — create a new account
        if (mode === 'signup') {
          if (!password || password.length < 4) return null

          // Check if username already exists
          const existing = await db.user.findFirst({
            where: {
              OR: [
                { username },
                { email: `${username}@redline.local` },
              ],
            },
          })
          if (existing) return null

          const hashedPassword = await bcrypt.hash(password, 10)
          const user = await db.user.create({
            data: {
              username,
              email: `${username}@redline.local`,
              name: username,
              password: hashedPassword,
            },
          })
          return user
        }

        // LOGIN MODE — verify credentials
        if (!password) return null

        const user = await db.user.findFirst({
          where: {
            OR: [
              { username },
              { email: `${username}@redline.local` },
            ],
          },
        })
        if (!user || !user.password) return null

        const valid = await bcrypt.compare(password, user.password)
        if (!valid) return null

        return user
      },
    }),

    // Admin login — hidden, no password, just the admin key
    Credentials({
      id: 'admin',
      name: 'Admin',
      credentials: {
        password: { label: 'Admin Key', type: 'password' },
      },
      async authorize(credentials, req) {
        const adminKey = process.env.ADMIN_API_KEY
        if (!adminKey) return null

        const ip = req?.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() ||
          req?.headers?.get?.('x-real-ip') || 'unknown'
        if (!checkAdminRateLimit(ip)) return null

        const key = (credentials?.password as string)?.trim()
        if (!key || key !== adminKey) return null

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
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id
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
