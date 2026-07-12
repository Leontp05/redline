'use client'

import { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial, Float, Wireframe } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'

/**
 * 3D wireframe chat bubble hero — gallery mode.
 *
 * A slowly rotating icosphere with a wireframe overlay, surrounded by a
 * drifting particle field. Red wireframe on charcoal. Pure visual art —
 * no text, no interaction. Scroll to enter the page.
 */

// ─── The wireframe bubble ───

function WireframeBubble() {
  const meshRef = useRef<THREE.Mesh>(null)
  const innerRef = useRef<THREE.Mesh>(null)

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.08
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.15) * 0.1
    }
    if (innerRef.current) {
      innerRef.current.rotation.y -= delta * 0.05
      innerRef.current.rotation.z += delta * 0.03
    }
  })

  return (
    <group>
      {/* Outer wireframe sphere */}
      <mesh ref={meshRef} scale={2.5}>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial
          color="#dc2626"
          wireframe
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* Inner glowing core */}
      <mesh ref={innerRef} scale={1.5}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#ef4444"
          wireframe
          transparent
          opacity={0.15}
        />
      </mesh>

      {/* Solid dark core to give depth */}
      <mesh scale={1.2}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#0a0a0b" />
      </mesh>
    </group>
  )
}

// ─── Particle field ───

function ParticleField({ count = 200 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null)

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // Distribute in a sphere shell around the bubble
      const radius = 4 + Math.random() * 6
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      arr[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      arr[i * 3 + 2] = radius * Math.cos(phi)
    }
    return arr
  }, [count])

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.02
    }
  })

  return (
    <Points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
        />
      </bufferGeometry>
      <PointMaterial
        size={0.03}
        color="#dc2626"
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  )
}

// ─── The scene ───

function HeroScene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 0]} intensity={2} color="#dc2626" distance={10} />

      <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
        <WireframeBubble />
      </Float>

      <ParticleField count={200} />

      <EffectComposer>
        <Bloom
          intensity={0.8}
          luminanceThreshold={0.1}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.4} darkness={0.7} />
      </EffectComposer>
    </>
  )
}

// ─── Exported component ───

export function GalleryHero() {
  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
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
