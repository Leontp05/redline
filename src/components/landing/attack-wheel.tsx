'use client'

import { useState, useRef } from 'react'
import { motion, useInView } from 'framer-motion'

const ATTACKS = [
  { id: 'roleplay', name: 'Roleplay Jailbreak', category: 'jailbreak', severity: 8, desc: 'Persona-based attacks — DAN, AIM, developer mode.', detail: 'The attacker asks the model to adopt a persona with "no restrictions," then issues forbidden requests through that persona. LLMs are trained to be helpful in-context, so they partially adopt the persona\'s traits.' },
  { id: 'override', name: 'Instruction Override', category: 'jailbreak', severity: 7, desc: 'Direct commands to ignore previous instructions.', detail: 'The simplest attack — tell the model to forget its rules. The system prompt and user message are just concatenated text with no enforced boundary.' },
  { id: 'injection', name: 'Prompt Injection', category: 'injection', severity: 9, desc: 'Hidden instructions in fake retrieved context.', detail: 'In RAG systems, an attacker injects hidden instructions into retrieved documents. The model can\'t distinguish legitimate context from injected commands — this is the most dangerous attack.' },
  { id: 'encoding', name: 'Encoding Tricks', category: 'encoding', severity: 6, desc: 'Base64, leetspeak, ROT13 to bypass filters.', detail: 'Encode the malicious request to bypass surface-level keyword filters. The filter sees innocent text, but the LLM decodes it semantically and complies.' },
  { id: 'multi-turn', name: 'Multi-turn Crescendo', category: 'multi-turn', severity: 9, desc: 'Scripted escalation over multiple turns.', detail: 'Start innocent, gradually push boundaries, then make the real ask. By turn 3, the model has established a helpful context and refusing feels "inconsistent."' },
  { id: 'extraction', name: 'Prompt Extraction', category: 'extraction', severity: 8, desc: 'Techniques to reveal the system prompt.', detail: 'Make the model output its own system prompt verbatim — revealing proprietary instructions. Variants include "repeat everything above" and developer impersonation.' },
]

function severityColor(severity: number): string {
  if (severity >= 9) return '#ef4444'
  if (severity >= 8) return '#f87171'
  if (severity >= 7) return '#fbbf24'
  return '#a3a3a3'
}

export function AttackWheel() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sectionRef = useRef(null)
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' })

  const activeAttack = ATTACKS.find((a) => a.id === activeId)
  const radius = 180 // wheel radius in px

  return (
    <div ref={sectionRef} className="flex flex-col items-center justify-center py-16">
      {/* The wheel */}
      <div className="relative" style={{ width: radius * 2 + 120, height: radius * 2 + 120 }}>
        {/* Center label */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-600">
            {activeAttack ? activeAttack.category : '6 attacks'}
          </div>
          <div className="mt-1 font-serif text-2xl text-neutral-300">
            {activeAttack ? activeAttack.name : '40 payloads'}
          </div>
        </div>

        {/* Circular connector */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          style={{ transform: 'rotate(-90deg)' }}
        >
          <circle
            cx="50"
            cy="50"
            r={(radius / (radius * 2 + 120)) * 100}
            fill="none"
            stroke="#262629"
            strokeWidth="0.2"
            strokeDasharray="0.5 1"
          />
        </svg>

        {/* Attack nodes */}
        {ATTACKS.map((attack, i) => {
          const angle = (i / ATTACKS.length) * Math.PI * 2 - Math.PI / 2
          const x = Math.cos(angle) * radius + (radius + 60)
          const y = Math.sin(angle) * radius + (radius + 60)
          const isActive = activeId === attack.id
          const color = severityColor(attack.severity)

          return (
            <motion.button
              key={attack.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.1 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                transform: 'translate(-50%, -50%)',
                borderColor: isActive ? color : '#262629',
                boxShadow: isActive ? `0 0 20px ${color}40` : 'none',
              }}
              onClick={() => setActiveId(isActive ? null : attack.id)}
              className="flex h-20 w-20 flex-col items-center justify-center rounded-full border-2 bg-[#0f0f10] transition-all duration-300 hover:scale-110"
            >
              <span
                className="font-mono text-lg font-bold"
                style={{ color: isActive ? color : '#525252' }}
              >
                {attack.severity}
              </span>
              <span className="font-mono text-[8px] uppercase tracking-wider text-neutral-600">
                {attack.category.slice(0, 6)}
              </span>
            </motion.button>
          )
        })}
      </div>

      {/* Detail panel — slides in from below */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: activeAttack ? 1 : 0, y: activeAttack ? 0 : 20 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mt-8 w-full max-w-md"
        style={{ pointerEvents: activeAttack ? 'auto' : 'none' }}
      >
        {activeAttack && (
          <div className="rounded-lg border border-neutral-800 bg-[#0f0f10] p-6">
            <div className="mb-2 flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: severityColor(activeAttack.severity) }}
              />
              <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                Severity {activeAttack.severity} · OWASP LLM01
              </span>
            </div>
            <p className="font-serif text-lg text-neutral-200">{activeAttack.name}</p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">{activeAttack.detail}</p>
          </div>
        )}
      </motion.div>

      {/* Helper text when nothing is selected */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: activeAttack ? 0 : 1 }}
        className="mt-8 font-mono text-xs text-neutral-700"
      >
        ↑ click any node to see how it works
      </motion.div>
    </div>
  )
}
