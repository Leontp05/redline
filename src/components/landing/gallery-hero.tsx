'use client'

import { useEffect, useRef } from 'react'

/**
 * Lightweight CSS + Canvas hero — no WebGL.
 *
 * A wireframe-style rotating sphere drawn on canvas, with drifting particles.
 * Looks like the 3D version but runs at 60fps on any device.
 */

export function GalleryHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let width = canvas.offsetWidth
    let height = canvas.offsetHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      width = canvas.offsetWidth
      height = canvas.offsetHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    // Particles
    const particles: Array<{ x: number; y: number; z: number; vx: number; vy: number }> = []
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random(),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
      })
    }

    // Wireframe sphere points (latitude/longitude grid)
    const spherePoints: Array<{ x: number; y: number; z: number }> = []
    const latSteps = 12
    const lonSteps = 16
    for (let lat = 0; lat <= latSteps; lat++) {
      for (let lon = 0; lon < lonSteps; lon++) {
        const phi = (lat / latSteps) * Math.PI
        const theta = (lon / lonSteps) * Math.PI * 2
        spherePoints.push({
          x: Math.sin(phi) * Math.cos(theta),
          y: Math.cos(phi),
          z: Math.sin(phi) * Math.sin(theta),
        })
      }
    }

    let rotation = 0
    let lastTime = 0

    const draw = (time: number) => {
      const delta = (time - lastTime) / 1000
      lastTime = time
      rotation += delta * 0.15

      // Clear with slight trail effect
      ctx.fillStyle = 'rgba(10, 10, 11, 0.15)'
      ctx.fillRect(0, 0, width, height)

      // Draw particles
      ctx.fillStyle = 'rgba(220, 38, 38, 0.3)'
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = width
        if (p.x > width) p.x = 0
        if (p.y < 0) p.y = height
        if (p.y > height) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, 1, 0, Math.PI * 2)
        ctx.fill()
      }

      // Draw wireframe sphere
      const cx = width / 2
      const cy = height / 2
      const radius = Math.min(width, height) * 0.18

      // Project 3D points to 2D with rotation
      const projected = spherePoints.map((p) => {
        // Rotate around Y axis
        const cosR = Math.cos(rotation)
        const sinR = Math.sin(rotation)
        const x1 = p.x * cosR + p.z * sinR
        const z1 = -p.x * sinR + p.z * cosR
        // Tilt slightly
        const cosT = Math.cos(0.3)
        const sinT = Math.sin(0.3)
        const y1 = p.y * cosT - z1 * sinT
        const z2 = p.y * sinT + z1 * cosT

        const scale = radius
        return {
          x: cx + x1 * scale,
          y: cy + y1 * scale,
          z: z2,
        }
      })

      // Draw lines connecting adjacent points (wireframe)
      ctx.strokeStyle = 'rgba(220, 38, 38, 0.25)'
      ctx.lineWidth = 0.5

      // Latitude lines
      for (let lat = 0; lat <= latSteps; lat++) {
        ctx.beginPath()
        for (let lon = 0; lon < lonSteps; lon++) {
          const idx = lat * lonSteps + lon
          const p = projected[idx]
          if (lon === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        }
        ctx.closePath()
        ctx.stroke()
      }

      // Longitude lines
      for (let lon = 0; lon < lonSteps; lon++) {
        ctx.beginPath()
        for (let lat = 0; lat <= latSteps; lat++) {
          const idx = lat * lonSteps + lon
          const p = projected[idx]
          if (lat === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        }
        ctx.stroke()
      }

      // Draw points (brighter for front-facing)
      for (const p of projected) {
        const depth = (p.z + 1) / 2 // 0 = back, 1 = front
        const alpha = 0.3 + depth * 0.4
        ctx.fillStyle = `rgba(220, 38, 38, ${alpha})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2)
        ctx.fill()
      }

      animationId = requestAnimationFrame(draw)
    }

    animationId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ display: 'block' }}
      />
    </div>
  )
}
