'use client'

import { useRef, useState, type ReactNode } from 'react'
import { motion, useInView, animate } from 'framer-motion'

const ease = [0.16, 1, 0.3, 1] as const

/**
 * 3D tilt card — tilts toward the cursor on hover.
 * Uses CSS perspective + transform. GPU-accelerated.
 */
export function TiltCard({
  children,
  className,
  glowColor = 'rgba(220, 38, 38, 0.15)',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  glowColor?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState('')
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 })
  const [isHovering, setIsHovering] = useState(false)
  const isInView = useInView(ref, { once: true, margin: '-30px' })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rotateX = ((y - centerY) / centerY) * -6 // max 6deg
    const rotateY = ((x - centerX) / centerX) * 6
    setTransform(`perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`)
    setGlowPos({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 })
  }

  const handleMouseLeave = () => {
    setTransform('perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)')
    setIsHovering(false)
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease }}
      style={{
        transform,
        transition: 'transform 0.15s ease-out',
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={handleMouseLeave}
      className={`group relative overflow-hidden rounded-lg border border-neutral-900 bg-[#0f0f10] ${className || ''}`}
    >
      {/* Glow that follows cursor */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at ${glowPos.x}% ${glowPos.y}%, ${glowColor}, transparent 60%)`,
          opacity: isHovering ? 1 : 0,
        }}
      />
      {/* Content stays above glow */}
      <div className="relative" style={{ transform: 'translateZ(20px)' }}>
        {children}
      </div>
    </motion.div>
  )
}

/**
 * Animated count-up number — counts from 0 to target when scrolled into view.
 */
export function CountUp({
  to,
  duration = 1.2,
  className,
  suffix = '',
}: {
  to: number
  duration?: number
  className?: string
  suffix?: string
}) {
  const [value, setValue] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })

  if (isInView && value === 0 && to > 0) {
    const controls = animate(0, to, {
      duration,
      ease,
      onUpdate: (v) => setValue(Math.round(v)),
    })
    return () => controls.stop()
  }

  return (
    <span ref={ref} className={className}>
      {value}{suffix}
    </span>
  )
}

/**
 * Animated circular gauge — SVG ring that fills from 0 to the score.
 */
export function CircularGauge({
  score,
  size = 120,
  strokeWidth = 3,
}: {
  score: number | null
  size?: number
  strokeWidth?: number
}) {
  const ref = useRef<SVGCircleElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  const radius = (size - strokeWidth * 2) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (score ?? 0) * (circumference / 100)
  const color = score == null ? '#525252' : score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1a1a1c"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <motion.circle
          ref={ref}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
          animate={isInView ? { strokeDashoffset: offset } : {}}
          transition={{ duration: 1.5, ease }}
          style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-2xl font-light" style={{ color }}>
          {score ?? '—'}
        </span>
        <span className="font-mono text-[8px] text-neutral-700">/ 100</span>
      </div>
    </div>
  )
}
