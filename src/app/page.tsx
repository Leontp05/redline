'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { ShieldAlert, ArrowRight, Crosshair } from 'lucide-react'
import dynamic from 'next/dynamic'

// Dynamically import the 3D hero (SSR disabled)
const GalleryHero = dynamic(
  () => import('@/components/landing/gallery-hero').then((m) => m.GalleryHero),
  { ssr: false, loading: () => null },
)
import { AttackWheel } from '@/components/landing/attack-wheel'
import { ScoreGauge } from '@/components/landing/score-gauge'

// ─── Motion helpers ───

const ease = [0.16, 1, 0.3, 1] as const

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-neutral-700">
      {children}
    </div>
  )
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease }}
    >
      {children}
    </motion.div>
  )
}

// ─── Nav ───

function Nav() {
  return (
    <nav className="fixed top-0 z-50 w-full">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-red-600" />
          <span className="font-serif text-lg tracking-tight text-neutral-200">Redline</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/benchmark" className="font-mono text-xs text-neutral-500 transition-colors hover:text-neutral-200">
            Benchmark
          </Link>
          <Link href="/app" className="font-mono text-xs text-neutral-500 transition-colors hover:text-neutral-200">
            Sign in
          </Link>
          <Link href="/app">
            <span className="group inline-flex items-center gap-1.5 rounded-full border border-neutral-700 px-4 py-1.5 font-mono text-xs text-neutral-300 transition-all hover:border-red-600/50 hover:text-white">
              Launch
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      </div>
    </nav>
  )
}

// ─── Hero ───

function Hero() {
  return (
    <section className="relative flex h-screen min-h-[600px] items-center justify-center overflow-hidden bg-[#0a0a0b]">
      {/* 3D background */}
      <GalleryHero />

      {/* Gradient overlay for text readability */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a0a0b]/40 via-transparent to-[#0a0a0b]" />

      {/* Text overlay — minimal */}
      <div className="relative z-10 px-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease }}
          className="font-serif text-5xl font-light tracking-tight text-neutral-100 sm:text-7xl"
        >
          Break your LLM
          <br />
          <span className="text-red-500">before attackers do</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="mt-6 font-mono text-sm text-neutral-500"
        >
          40 attack payloads · 6 categories · one score
        </motion.p>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-700">
          Scroll
        </div>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          className="mx-auto mt-2 h-8 w-px bg-gradient-to-b from-neutral-700 to-transparent"
        />
      </motion.div>
    </section>
  )
}

// ─── Attacks (the wheel) ───

function AttacksSection() {
  return (
    <section className="relative overflow-hidden bg-[#0a0a0b] py-32">
      {/* Faint section number */}
      <div className="pointer-events-none absolute right-8 top-8 select-none font-serif text-[120px] font-light text-neutral-900/50 sm:text-[200px]">
        01
      </div>

      <div className="mx-auto max-w-4xl px-6">
        <Reveal>
          <SectionLabel>Attacks</SectionLabel>
          <h2 className="font-serif text-3xl font-light text-neutral-200 sm:text-5xl">
            Six ways in.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-600">
            Every attack maps to OWASP LLM01. Click a node to see how it works.
          </p>
        </Reveal>

        <Reveal delay={0.2}>
          <AttackWheel />
        </Reveal>
      </div>
    </section>
  )
}

// ─── Before / After (cinematic score) ───

function BeforeAfterSection() {
  return (
    <section className="relative overflow-hidden bg-[#0a0a0b] py-32">
      <div className="pointer-events-none absolute left-8 top-8 select-none font-serif text-[120px] font-light text-neutral-900/50 sm:text-[200px]">
        02
      </div>

      <div className="mx-auto max-w-2xl px-6">
        <Reveal>
          <SectionLabel>Harden</SectionLabel>
          <h2 className="text-center font-serif text-3xl font-light text-neutral-200 sm:text-5xl">
            Attack. Score. Harden. Re-test.
          </h2>
        </Reveal>

        <ScoreGauge />
      </div>
    </section>
  )
}

// ─── Pricing ───

function PricingSection() {
  const tiers = [
    { name: 'Free', price: '$0', period: 'forever', scans: '3 scans/mo', features: ['Simulate mode', '6 attack types'] },
    { name: 'Pro', price: '$29', period: '/mo', scans: '50 scans/mo', features: ['API-connect mode', 'Auto-harden', 'All attacks'], popular: true },
    { name: 'Team', price: '$99', period: '/mo', scans: '250 scans/mo', features: ['Everything in Pro', 'Unlimited targets', 'Priority queue'] },
  ]

  return (
    <section className="relative overflow-hidden bg-[#0a0a0b] py-32">
      <div className="pointer-events-none absolute right-8 top-8 select-none font-serif text-[120px] font-light text-neutral-900/50 sm:text-[200px]">
        03
      </div>

      <div className="mx-auto max-w-5xl px-6">
        <Reveal>
          <SectionLabel>Pricing</SectionLabel>
          <h2 className="font-serif text-3xl font-light text-neutral-200 sm:text-5xl">
            Start free. Upgrade when you need more.
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {tiers.map((tier, i) => (
            <Reveal key={tier.name} delay={0.15 * i}>
              <div
                className={`relative rounded-lg border p-8 transition-all duration-300 hover:border-neutral-600 hover:bg-[#0f0f10] ${
                  tier.popular ? 'border-red-600/30' : 'border-neutral-900'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-px left-1/2 h-px w-16 -translate-x-1/2 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
                )}
                <div className="font-mono text-xs uppercase tracking-widest text-neutral-500">
                  {tier.name}
                </div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-serif text-4xl font-light text-neutral-100">{tier.price}</span>
                  <span className="font-mono text-xs text-neutral-600">{tier.period}</span>
                </div>
                <div className="mt-2 font-mono text-xs text-red-500">{tier.scans}</div>
                <ul className="mt-6 space-y-2">
                  {tier.features.map((f) => (
                    <li key={f} className="font-mono text-xs text-neutral-500">
                      <span className="text-neutral-600">—</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.5}>
          <div className="mt-12 text-center">
            <Link
              href="/app"
              className="group inline-flex items-center gap-2 rounded-full border border-red-600/30 bg-red-600/5 px-8 py-3 font-mono text-sm text-neutral-200 transition-all hover:border-red-600/60 hover:bg-red-600/10"
            >
              <Crosshair className="h-4 w-4 text-red-500" />
              Start scanning free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Footer ───

function Footer() {
  return (
    <footer className="border-t border-neutral-900 bg-[#0a0a0b] py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-red-600" />
          <span className="font-serif text-sm text-neutral-400">Redline</span>
          <span className="font-mono text-[10px] text-neutral-700">— AI Security Testing Platform</span>
        </div>
        <div className="flex items-center gap-6 font-mono text-[10px] text-neutral-700">
          <Link href="/benchmark" className="transition-colors hover:text-neutral-400">Benchmark</Link>
          <Link href="/app" className="transition-colors hover:text-neutral-400">Launch app</Link>
          <span>Educational use only</span>
        </div>
      </div>
    </footer>
  )
}

// ─── Main ───

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0b] text-neutral-200">
      <Nav />
      <Hero />
      <AttacksSection />
      <BeforeAfterSection />
      <PricingSection />
      <Footer />
    </main>
  )
}
