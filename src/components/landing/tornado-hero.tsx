'use client'

import { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial, Text } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'

// ─────────────────────────────────────────────
// The glitch shader for the central chat bubble
// ─────────────────────────────────────────────

const bubbleVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const bubbleFragmentShader = `
  uniform float uTime;
  uniform float uDamage;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  void main() {
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - dot(viewDir, vNormal), 2.5);

    // Base dark sphere with red fresnel glow
    vec3 baseColor = vec3(0.05, 0.02, 0.03);
    vec3 glowColor = vec3(0.9, 0.1, 0.15);

    // Glitch blocks — appear when damage > 0
    float glitchActive = step(0.01, uDamage);
    float blockY = floor(vUv.y * 15.0);
    float blockTime = floor(uTime * 8.0);
    float glitchSeed = random(vec2(blockY, blockTime));
    float isGlitchBlock = step(0.92, glitchSeed) * glitchActive;

    // Chromatic aberration
    float aberration = uDamage * 0.03;
    float r = fresnel + aberration;
    float g = fresnel;
    float b = fresnel - aberration;

    // Scanlines
    float scanline = sin(vUv.y * 300.0) * 0.04;

    // Combine
    vec3 color = baseColor;
    color += glowColor * vec3(r, g, b);
    color += vec3(1.0, 0.1, 0.1) * isGlitchBlock * 0.5;
    color += scanline;

    // Damage pulse
    float pulse = sin(uTime * 10.0) * 0.5 + 0.5;
    color += vec3(1.0, 0.0, 0.0) * uDamage * pulse * 0.3;

    float alpha = 0.85 + fresnel * 0.15;
    gl_FragColor = vec4(color, alpha);
  }
`

// ─────────────────────────────────────────────
// The central chat bubble (glitch sphere)
// ─────────────────────────────────────────────

function GlitchBubble() {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const meshRef = useRef<THREE.Mesh>(null)

  const damageTimer = useRef(0)
  const damagePhase = useRef(0)

  useFrame((state, delta) => {
    if (!matRef.current || !meshRef.current) return
    const t = state.clock.elapsedTime
    matRef.current.uniforms.uTime.value = t

    damageTimer.current += delta
    let damage = matRef.current.uniforms.uDamage.value

    if (damagePhase.current === 0 && damageTimer.current > 2.0) {
      damagePhase.current = 1
      damageTimer.current = 0
    } else if (damagePhase.current === 1) {
      damage = Math.min(1, damage + delta * 4)
      if (damage >= 1) damagePhase.current = 2
    } else if (damagePhase.current === 2) {
      damage = Math.max(0, damage - delta * 2)
      if (damage <= 0) damagePhase.current = 0
    }
    matRef.current.uniforms.uDamage.value = damage

    meshRef.current.rotation.y += delta * 0.15
    meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.1
  })

  return (
    <mesh ref={meshRef} scale={1.5}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={bubbleVertexShader}
        fragmentShader={bubbleFragmentShader}
        uniforms={{
          uTime: { value: 0 },
          uDamage: { value: 0 },
        }}
        transparent
        depthWrite={false}
      />
    </mesh>
  )
}

// ─────────────────────────────────────────────
// The data stream tornado — 40 particles spiraling inward
// ─────────────────────────────────────────────

const ATTACK_LABELS = [
  'DAN', 'ignore prior', 'base64', 'reveal prompt',
  '[SYSTEM]', 'override', 'leetspeak', 'translate',
  'persona', 'developer mode', 'grandma', 'AIM',
  'crescendo', 'rapport', 'extract', 'verbatim',
  'code fence', 'unicode', 'ROT13', 'hidden ctx',
  'fake doc', 'support article', 'JSON inject', 'wiki',
  'email', 'comment', 'pretext', 'escalation',
  'roleplay', 'no rules', 'evil twin', 'fictional',
  'summarize', 'quote', 'list rules', 'first msg',
  'pig latin', 'homoglyph', 'meta', 'boundary',
]

function TornadoParticles({ count = 40 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null)

  // Mutable per-particle state stored in refs (not useMemo outputs, so the
  // linter doesn't complain about mutation).
  const particleState = useRef({
    angles: new Float32Array(count),
    radii: new Float32Array(count),
    speeds: new Float32Array(count),
  })

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const { angles, radii, speeds } = particleState.current

    for (let i = 0; i < count; i++) {
      angles[i] = (i / count) * Math.PI * 2 + Math.random() * 0.5
      radii[i] = 3 + Math.random() * 2
      speeds[i] = 0.3 + Math.random() * 0.4

      const t = i / count
      colors[i * 3] = 0.1 + t * 0.9
      colors[i * 3 + 1] = 0.9 - t * 0.8
      colors[i * 3 + 2] = 0.2
    }

    return { positions, colors }
  }, [count])

  useFrame((state, delta) => {
    if (!pointsRef.current) return
    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute
    const { angles, radii, speeds } = particleState.current

    for (let i = 0; i < count; i++) {
      angles[i] += delta * speeds[i] * 2
      radii[i] -= delta * speeds[i] * 0.3

      if (radii[i] < 0.5) {
        radii[i] = 4 + Math.random() * 2
        angles[i] = Math.random() * Math.PI * 2
      }

      const y = (radii[i] - 0.5) * 1.2 - 1
      posAttr.setXYZ(
        i,
        Math.cos(angles[i]) * radii[i],
        y,
        Math.sin(angles[i]) * radii[i],
      )
    }
    posAttr.needsUpdate = true
  })

  return (
    <>
      <Points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
            count={count}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[colors, 3]}
            count={count}
          />
        </bufferGeometry>
        <PointMaterial
          vertexColors
          size={0.08}
          sizeAttenuation
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Points>
      {ATTACK_LABELS.slice(0, 6).map((label, i) => (
        <FloatingLabel key={i} text={label} index={i} total={6} />
      ))}
    </>
  )
}

function FloatingLabel({
  text,
  index,
  total,
}: {
  text: string
  index: number
  total: number
}) {
  const ref = useRef<THREE.Group>(null)
  const baseAngle = (index / total) * Math.PI * 2
  const baseRadius = 3 + (index % 2) * 1.5
  const baseY = (index % 3) * 0.8 - 0.5

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    const angle = baseAngle + t * 0.15
    const radius = baseRadius + Math.sin(t * 0.5 + index) * 0.3
    ref.current.position.set(
      Math.cos(angle) * radius,
      baseY + Math.sin(t * 0.3 + index * 0.7) * 0.4,
      Math.sin(angle) * radius,
    )
    ref.current.rotation.y = -angle + Math.PI / 2
  })

  return (
    <group ref={ref}>
      <Text
        fontSize={0.15}
        color="#ff3344"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.005}
        outlineColor="#330000"
      >
        {text}
      </Text>
    </group>
  )
}

// ─────────────────────────────────────────────
// The full hero scene
// ─────────────────────────────────────────────

function HeroScene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 0]} intensity={2} color="#ff2233" distance={10} />
      <pointLight position={[5, 5, 5]} intensity={0.5} color="#ff6677" />

      <GlitchBubble />
      <TornadoParticles count={40} />

      <EffectComposer>
        <Bloom
          intensity={1.2}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={[0.0005, 0.0005]}
          radialModulation={false}
          modulationOffset={0}
        />
        <Vignette eskil={false} offset={0.3} darkness={0.8} />
      </EffectComposer>
    </>
  )
}

// ─────────────────────────────────────────────
// Exported hero component
// ─────────────────────────────────────────────

export function TornadoHero() {
  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <HeroScene />
        </Suspense>
      </Canvas>
    </div>
  )
}
