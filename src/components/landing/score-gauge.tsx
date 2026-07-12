'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, useInView, animate } from 'framer-motion'

/**
 * Cinematic score gauge — counts up from 0 to 71 (red), then to 100 (green).
 * Full-screen, minimal, dramatic.
 */

function CountUp({ to, duration, color, label }: { to: number; duration: number; color: string; label: string }) {
  const [value, setValue] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (!isInView) return
    const controls = animate(0, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    })
    return () => controls.stop()
  }, [isInView, to, duration])

  return (
    <div ref={ref} className="flex flex-col items-center">
      <div
        className="font-serif text-7xl font-light tabular-nums sm:text-9xl"
        style={{ color }}
      >
        {value}
      </div>
      <div className="mt-2 font-mono text-xs uppercase tracking-widest text-neutral-600">
        {label}
      </div>
    </div>
  )
}

export function ScoreGauge() {
  const sectionRef = useRef(null)
  const isInView = useInView(sectionRef, { once: true, margin: '-200px' })
  const [phase, setPhase] = useState<'before' | 'after'>('before')

  useEffect(() => {
    if (!isInView) return
    // Phase 1: count to 71 (red). After 2.5s, switch to "after" (count to 100).
    const timer = setTimeout(() => {
      setPhase('after')
    }, 3000)
    return () => clearTimeout(timer)
  }, [isInView])

  const score = phase === 'before' ? 71 : 100
  const color = phase === 'before' ? '#ef4444' : '#10b981'
  const label = phase === 'before' ? 'Before — vulnerable' : 'After hardening — defended'

  return (
    <div ref={sectionRef} className="flex flex-col items-center justify-center py-24">
      {/* The score */}
      <motion.div
        key={phase}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <CountUp to={score} duration={phase === 'before' ? 2 : 3} color={color} label={label} />
      </motion.div>

      {/* Circular progress ring */}
      <div className="relative mt-8 h-48 w-48 sm:h-64 sm:w-64">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          {/* Background ring */}
          <circle cx="50" cy="50" r="45" fill="none" stroke="#1a1a1c" strokeWidth="2" />
          {/* Progress ring */}
          <motion.circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ strokeDasharray: '0 283' }}
            animate={{ strokeDasharray: `${(score / 100) * 283} 283` }}
            transition={{ duration: phase === 'before' ? 2 : 3, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: `drop-shadow(0 0 8px ${color}80)` }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-xs uppercase tracking-widest text-neutral-600">
            / 100
          </span>
        </div>
      </div>

      {/* Delta indicator */}
      {phase === 'after' && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 2, duration: 0.6, type: 'spring', bounce: 0.5 }}
          className="mt-8 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-6 py-2 font-mono text-sm font-semibold text-emerald-400"
        >
          ▲ +29 points · 13 vulnerabilities closed
        </motion.div>
      )}

      {/* Phase indicator dots */}
      <div className="mt-8 flex gap-2">
        <div
          className={`h-1.5 w-8 rounded-full transition-colors duration-500 ${phase === 'before' ? 'bg-red-500' : 'bg-neutral-800'}`}
        />
        <div
          className={`h-1.5 w-8 rounded-full transition-colors duration-500 ${phase === 'after' ? 'bg-emerald-500' : 'bg-neutral-800'}`}
        />
      </div>
    </div>
  )
}
