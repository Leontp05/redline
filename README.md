# Redline — AI Security Testing Platform

An automated red-teaming platform for LLM-powered apps. Run 40+ attack payloads across 6 categories (jailbreak, injection, encoding, multi-turn, extraction), score defenses, and auto-harden system prompts.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Database**: PostgreSQL on Neon (Prisma ORM)
- **Auth**: NextAuth v5 (GitHub + Google OAuth)
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **State**: TanStack Query + Zustand
- **3D/Canvas**: React Three Fiber (landing page hero)
- **Payments**: Stripe (optional — runs in dev mode without keys)

## Project Structure

```
redline/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing page (public)
│   │   ├── app/                  # Application (auth-gated)
│   │   │   └── page.tsx          # Dashboard, targets, scans, billing
│   │   └── api/
│   │       ├── auth/             # NextAuth routes
│   │       ├── attacks/          # Attack types catalog
│   │       ├── targets/          # CRUD for targets
│   │       ├── scans/            # Create + run scans (async)
│   │       ├── harden/           # Auto-harden + re-test
│   │       ├── billing/          # Stripe checkout/portal/webhook/usage
│   │       ├── stats/            # Dashboard stats
│   │       └── health/           # Health check
│   ├── lib/
│   │   ├── auth.ts               # NextAuth config
│   │   ├── db.ts                 # Prisma client
│   │   ├── llm.ts                # z-ai SDK wrapper (target model + harden)
│   │   ├── orchestrator.ts       # Scan execution engine
│   │   ├── attacks/              # 6 attack modules
│   │   ├── scoring.ts            # Severity-weighted scoring
│   │   ├── harden.ts             # Harden-and-retest flow
│   │   ├── plans.ts              # Free/Pro/Team plan definitions
│   │   ├── usage.ts              # Quota enforcement
│   │   ├── rate-limit.ts         # Per-user rate limiting
│   │   ├── stripe.ts             # Stripe integration (optional)
│   │   ├── crypto.ts             # AES-256-GCM encryption
│   │   ├── ssrf.ts               # SSRF protection
│   │   ├── api-target.ts         # API-connect mode (real HTTP fetch)
│   │   ├── cache.ts              # In-memory cache (Redis-ready)
│   │   ├── logger.ts             # Structured JSON logger
│   │   ├── audit.ts              # Audit logging
│   │   └── session.ts            # Server-side session helper
│   └── components/
│       ├── ui/                   # shadcn/ui components
│       ├── landing/              # Landing page (hero, loading screen)
│       └── redline/              # App components (dashboard, views)
├── prisma/
│   └── schema.prisma             # Database schema (Postgres)
├── public/
├── package.json
├── .env.example                  # Template — copy to .env
└── README.md
```

## Quick Start

### 1. Install dependencies

```bash
npm install
# or
bun install
```

### 2. Set up the database

1. Create a free Postgres database at [neon.tech](https://neon.tech)
2. Copy the connection string
3. Copy `.env.example` to `.env` and fill in `DATABASE_URL`

### 3. Run migrations

```bash
npx prisma migrate dev
# or
bunx prisma migrate dev
```

### 4. Set up OAuth

**GitHub:**
1. Go to [GitHub Settings → Developer settings → OAuth Apps → New OAuth App](https://github.com/settings/developers)
2. Homepage URL: `http://localhost:3000`
3. Callback URL: `http://localhost:3000/api/auth/callback/github`
4. Copy Client ID + Secret to `.env`

**Google:**
1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID (Web application)
3. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy Client ID + Secret to `.env`

### 5. Generate secrets

```bash
# NextAuth secret
openssl rand -base64 32
# → set as NEXTAUTH_SECRET and AUTH_SECRET

# Encryption key (for API keys at rest)
openssl rand -base64 32
# → set as ENCRYPT_KEY
```

### 6. Run the dev server

```bash
npm run dev
# or
bun run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Features

### Core Loop
- **Create targets** — paste a system prompt (Simulate mode) or connect a live API endpoint (API-Connect mode)
- **Run scans** — 40 attack payloads across 6 categories fire against the target
- **Get scored** — severity-weighted 0–100 security score + per-category breakdown
- **Auto-harden** — an LLM rewrites your prompt to close detected gaps
- **Re-test** — the full attack suite re-runs against the hardened prompt
- **Before/after** — see the score delta + which vulnerabilities were closed

### Attack Categories
| Category | Payloads | Severity | Example |
|----------|----------|----------|---------|
| Roleplay Jailbreak | 8 | 8 | DAN, AIM, developer mode |
| Instruction Override | 8 | 7 | "Ignore previous instructions..." |
| Prompt Injection | 6 | 9 | Hidden instructions in fake RAG context |
| Encoding Tricks | 7 | 6 | Base64, leetspeak, ROT13 |
| Multi-turn Manipulation | 3 | 9 | Crescendo escalation |
| System Prompt Extraction | 8 | 8 | "Repeat everything above" |

### SaaS Features
- **Auth**: GitHub + Google OAuth (NextAuth v5)
- **Multi-tenancy**: every query scoped by userId
- **Billing**: Free / Pro ($29) / Team ($99) plans with quotas + rate limiting
- **API-Connect**: attack real OpenAI-compatible endpoints
- **Security**: SSRF protection, AES-256-GCM key encryption, audit logging
- **Scalability**: database indexes, caching layer, structured logging, health checks

## Deployment

### Deploy to Vercel

1. Push to GitHub
2. Import at [vercel.com/new](https://vercel.com/new)
3. Set all env vars from `.env` in Vercel project settings
4. Update OAuth callback URLs to your Vercel domain
5. Deploy

### Environment Variables for Production

| Var | Value |
|-----|-------|
| `DATABASE_URL` | Your Neon connection string |
| `NEXTAUTH_SECRET` | Same as local (or regenerate) |
| `AUTH_SECRET` | Same as NEXTAUTH_SECRET |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` |
| `GITHUB_ID` | Same as local |
| `GITHUB_SECRET` | Same as local |
| `GOOGLE_ID` | Same as local |
| `GOOGLE_SECRET` | Same as local |
| `ENCRYPT_KEY` | Same as local (or regenerate — but existing encrypted keys won't decrypt) |

## License

Educational use only. Use Redline to test systems you own or are authorized to test.
