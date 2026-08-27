import { useEffect, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { P2PLink, Robot } from "../../engine/types"
import { TILE_SIZE } from "../../engine/warehouse"

interface P2PLinesProps {
  robots: Robot[]
  links: P2PLink[]
}

/** Animated peer-to-peer radio links, shown only on the decentralized warehouse. */
export function P2PLines({ robots, links }: P2PLinesProps) {
  // Build an id→robot lookup on the fly (no useMemo needed — just a local variable)
  const robotsById = new Map(robots.map((robot) => [robot.id, robot]))

  return (
    <group>
      {links.map((link) => {
        const from = robotsById.get(link.from)
        const to = robotsById.get(link.to)
        if (!from || !to) return null
        return (
          <P2PLinkLine
            key={`${link.from}-${link.to}`}
            from={from.position}
            to={to.position}
          />
        )
      })}
    </group>
  )
}

interface P2PLinkLineProps {
  from: { x: number; y: number }
  to: { x: number; y: number }
}

// ── Three.js object bundle stored in a ref so React Compiler never treats
//    them as "render-time locals" — mutations in useFrame are always safe. ──
interface LineBundle {
  geometry:    THREE.BufferGeometry
  primaryMat:  THREE.LineBasicMaterial
  glowMat:     THREE.LineBasicMaterial
  primaryLine: THREE.Line
  glowLine:    THREE.Line
}

function P2PLinkLine({ from, to }: P2PLinkLineProps) {
  // ── Interpolated world positions (mirrors damp() in RobotMesh) ──────────────
  const interpFrom = useRef(new THREE.Vector2(from.x * TILE_SIZE, -from.y * TILE_SIZE))
  const interpTo   = useRef(new THREE.Vector2(to.x   * TILE_SIZE, -to.y   * TILE_SIZE))

  // ── All Three.js objects live in a single ref — completely outside React's
  //    render graph, so the compiler never flags mutations on them. ────────────
  const bundle = useRef<LineBundle | null>(null)

  if (bundle.current === null) {
    // Lazy init on first render — equivalent to useMemo(fn, []) but ref-safe.
    const pts = [
      new THREE.Vector3(interpFrom.current.x, interpFrom.current.y, 0.5),
      new THREE.Vector3(interpTo.current.x,   interpTo.current.y,   0.5),
    ]
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    ;(geo.attributes.position as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)

    const primaryMat = new THREE.LineBasicMaterial({
      color: "#22d3ee",
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      depthTest: false,
    })

    const glowMat = new THREE.LineBasicMaterial({
      color: "#67e8f9", // sky-300 — lighter/more saturated for the soft halo
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      depthTest: false,
    })

    bundle.current = {
      geometry:    geo,
      primaryMat,
      glowMat,
      primaryLine: new THREE.Line(geo, primaryMat),
      glowLine:    new THREE.Line(geo, glowMat),
    }
  }

  // ── Per-frame: interpolate endpoints + pulse opacity ────────────────────────
  useFrame(({ clock }, delta) => {
    const b = bundle.current
    if (!b) return

    const targetFromX = from.x * TILE_SIZE
    const targetFromY = -from.y * TILE_SIZE
    const targetToX   = to.x * TILE_SIZE
    const targetToY   = -to.y * TILE_SIZE

    // Same lambda=9 as RobotMesh → ray endpoints track sprites frame-perfectly.
    interpFrom.current.x = THREE.MathUtils.damp(interpFrom.current.x, targetFromX, 9, delta)
    interpFrom.current.y = THREE.MathUtils.damp(interpFrom.current.y, targetFromY, 9, delta)
    interpTo.current.x   = THREE.MathUtils.damp(interpTo.current.x,   targetToX,   9, delta)
    interpTo.current.y   = THREE.MathUtils.damp(interpTo.current.y,   targetToY,   9, delta)

    // Rewrite the Float32Array buffer in-place — zero allocation per frame.
    const pos = b.geometry.attributes.position as THREE.BufferAttribute
    pos.setXYZ(0, interpFrom.current.x, interpFrom.current.y, 0.5)
    pos.setXYZ(1, interpTo.current.x,   interpTo.current.y,   0.5)
    pos.needsUpdate = true

    // Pulse opacity — boosted range so the ray reads clearly at all times.
    const t = clock.getElapsedTime()
    b.primaryMat.opacity = 0.70 + (Math.sin(t * 4) + 1) * 0.15  // 0.70 → 1.00
    b.glowMat.opacity    = 0.22 + (Math.sin(t * 4) + 1) * 0.09  // 0.22 → 0.40
  })

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      const b = bundle.current
      if (!b) return
      b.geometry.dispose()
      b.primaryMat.dispose()
      b.glowMat.dispose()
    }
  }, []) // mount/unmount only — bundle.current never changes identity

  if (!bundle.current) return null

  return (
    <group>
      {/* Soft glow halo rendered first (behind the crisp line) */}
      <primitive object={bundle.current.glowLine} />
      {/* Primary crisp ray on top */}
      <primitive object={bundle.current.primaryLine} />
    </group>
  )
}
