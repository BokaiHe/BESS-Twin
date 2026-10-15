import { memo, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Mesh, MeshStandardMaterial } from 'three'
import { Beam, Box, Cylinder, Tree, type V3 } from './geometry'

export const PALETTE = {
  renewable: '#22b07d',
  grid: '#3d74f6',
  charge: '#14b8d4',
  discharge: '#f59e0b',
  alarm: '#ef4444',
  warn: '#f59e0b',
  idle: '#9fb0c2',
  steel: '#a3b1bf',
  white: '#f6f8fb',
  panel: '#2f4f86',
}

/* ---------------- Generation ---------------- */

export const SolarFarm = memo(function SolarFarm({
  output,
  ratedMW = 16,
}: {
  output: number
  ratedMW?: number
}) {
  const glint = ratedMW > 0 ? Math.min(1, output / ratedMW) : 0
  const rows = 6,
    cols = 9
  return (
    <group>
      <Box at={[0, 0.02, 0]} size={[11.5, 0.04, 8.6]} color="#dfece5" shadow={false} />
      {Array.from({ length: rows * cols }, (_, i) => {
        const r = Math.floor(i / cols),
          c = i % cols
        return (
          <group key={i} position={[(c - (cols - 1) / 2) * 1.18, 0, (r - (rows - 1) / 2) * 1.3]}>
            <Box at={[0, 0.3, 0.12]} size={[0.06, 0.6, 0.06]} color="#b8c2cc" />
            <Box at={[0, 0.2, -0.26]} size={[0.06, 0.4, 0.06]} color="#b8c2cc" />
            <group position={[0, 0.55, 0]} rotation={[-0.42, 0, 0]}>
              <Box
                size={[1.08, 0.05, 0.96]}
                color={PALETTE.panel}
                roughness={0.25}
                metalness={0.35}
                emissive="#5fa8ff"
                emissiveIntensity={0.05 + glint * 0.25}
              />
              <Box at={[0, 0.028, 0]} size={[0.015, 0.01, 0.96]} color="#9cc3ec" shadow={false} />
              <Box at={[0, 0.028, 0]} size={[1.08, 0.01, 0.015]} color="#9cc3ec" shadow={false} />
            </group>
          </group>
        )
      })}
      {[-3.5, 0, 3.5].map((x) => (
        <group key={x} position={[x, 0, 4.9]}>
          <Box at={[0, 0.45, 0]} size={[0.9, 0.9, 0.6]} color="#e8edf2" />
          <Box
            at={[0, 0.6, 0.31]}
            size={[0.5, 0.08, 0.02]}
            color={PALETTE.renewable}
            emissive={PALETTE.renewable}
            emissiveIntensity={glint}
            shadow={false}
          />
        </group>
      ))}
    </group>
  )
})

export function WindTurbine({ output, ratedMW = 4 }: { output: number; ratedMW?: number }) {
  const rotor = useRef<Group>(null)
  useFrame((_, dt) => {
    if (rotor.current && output > 0.001 && ratedMW > 0)
      rotor.current.rotation.z -= dt * (0.25 + Math.min(1, output / ratedMW) * 2.6)
  })
  return (
    <group>
      <Cylinder at={[0, 0.15, 0]} r={0.8} h={0.3} color="#e3e9ef" segments={8} />
      <Cylinder at={[0, 3.3, 0]} r={0.24} rTop={0.12} h={6.2} color={PALETTE.white} />
      <group position={[0, 6.45, 0]}>
        <Box at={[0, 0, -0.15]} size={[0.5, 0.48, 1.3]} color="#eef2f6" />
        <group ref={rotor} position={[0, 0, 0.58]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <coneGeometry args={[0.24, 0.5, 12]} />
            <meshStandardMaterial color="#e9eef4" />
          </mesh>
          {[0, 1, 2].map((i) => (
            <group key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]}>
              <mesh position={[0, 1.5, 0]} castShadow>
                <boxGeometry args={[0.26, 2.9, 0.07]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.5} />
              </mesh>
              <mesh position={[0, 2.85, 0]}>
                <boxGeometry args={[0.16, 0.3, 0.075]} />
                <meshStandardMaterial color="#f28b6c" />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  )
}

/* ---------------- Grid ---------------- */

export function LatticeTower({ height = 6 }: { height?: number }) {
  const legs: [V3, V3][] = [
    [
      [-0.9, 0, -0.9],
      [-0.22, height, -0.22],
    ],
    [
      [0.9, 0, -0.9],
      [0.22, height, -0.22],
    ],
    [
      [-0.9, 0, 0.9],
      [-0.22, height, 0.22],
    ],
    [
      [0.9, 0, 0.9],
      [0.22, height, 0.22],
    ],
  ]
  const levels = [1.4, 2.8, 4.2]
  const w = (y: number) => 0.9 - (0.68 * y) / height
  return (
    <group>
      {legs.map(([a, b], i) => (
        <Beam key={i} a={a} b={b} r={0.09} color={PALETTE.steel} />
      ))}
      {levels.flatMap((y, li) => {
        const k = w(y),
          k2 = w(levels[li + 1] ?? height)
        const y2 = levels[li + 1] ?? height
        return [
          <Beam key={`x${y}`} a={[-k, y, k]} b={[k2, y2, k2]} r={0.04} color={PALETTE.steel} />,
          <Beam key={`z${y}`} a={[k, y, k]} b={[-k2, y2, k2]} r={0.04} color={PALETTE.steel} />,
          <Beam key={`h${y}`} a={[-k, y, k]} b={[k, y, k]} r={0.05} color={PALETTE.steel} />,
        ]
      })}
      {[height - 0.9, height - 0.1].map((y, i) => (
        <group key={y}>
          <Box at={[0, y, 0]} size={[i ? 2.6 : 3.6, 0.12, 0.22]} color="#93a2b1" />
          {[-1, 0, 1].map((s) =>
            i === 0 || s === 0 ? (
              <Cylinder
                key={s}
                at={[s * 1.5, y - 0.35, 0]}
                r={0.07}
                h={0.6}
                color="#7f93ad"
                segments={6}
              />
            ) : null,
          )}
        </group>
      ))}
    </group>
  )
}

function Transformer({ at, scale = 1 }: { at: V3; scale?: number }) {
  return (
    <group position={at} scale={scale}>
      <Box at={[0, 0.65, 0]} size={[1.3, 1.1, 0.9]} color="#c9d4de" />
      {[-0.45, -0.15, 0.15, 0.45].map((x) => (
        <Box key={x} at={[x, 0.6, 0.5]} size={[0.08, 0.9, 0.12]} color="#b3c0cc" />
      ))}
      {[-0.35, 0, 0.35].map((x) => (
        <Cylinder
          key={x}
          at={[x, 1.45, 0]}
          r={0.07}
          rTop={0.04}
          h={0.6}
          color="#8fa3b8"
          segments={8}
        />
      ))}
    </group>
  )
}

function Fence({ w, d, h = 0.55 }: { w: number; d: number; h?: number }) {
  const c = '#c4cdd6'
  return (
    <group>
      {[
        [
          [-w / 2, h, -d / 2],
          [w / 2, h, -d / 2],
        ],
        [
          [-w / 2, h, d / 2],
          [w / 2, h, d / 2],
        ],
        [
          [-w / 2, h, -d / 2],
          [-w / 2, h, d / 2],
        ],
        [
          [w / 2, h, -d / 2],
          [w / 2, h, d / 2],
        ],
      ].map(([a, b], i) => (
        <Beam key={i} a={a as V3} b={b as V3} r={0.035} color={c} />
      ))}
      {[-w / 2, w / 2].flatMap((x) =>
        [-d / 2, d / 2].map((z) => (
          <Box key={`${x}${z}`} at={[x, h / 2, z]} size={[0.07, h, 0.07]} color={c} />
        )),
      )}
    </group>
  )
}

export function Substation({ variant }: { variant: 'pcc' | 'distribution' | 'lv' }) {
  if (variant === 'lv')
    return (
      <group>
        <Box at={[0, 0.05, 0]} size={[2.2, 0.1, 1.8]} color="#d7dee5" />
        <Transformer at={[0, 0.1, 0]} scale={0.8} />
        <Fence w={2.2} d={1.8} />
      </group>
    )
  const w = variant === 'pcc' ? 5.2 : 4.2
  return (
    <group>
      <Box at={[0, 0.05, 0]} size={[w, 0.1, 3.6]} color="#d7dee5" />
      <Transformer at={[-w / 4, 0.1, 0.2]} />
      <Transformer at={[w / 4, 0.1, 0.2]} />
      <Fence w={w} d={3.6} />
    </group>
  )
}

/** Line-termination gantry; the cross beam lies along local x. */
export function Gantry({ height = 3.2 }: { height?: number }) {
  return (
    <group>
      {[-1.8, 1.8].map((x) => (
        <Beam key={x} a={[x, 0, 0]} b={[x, height, 0]} r={0.12} color={PALETTE.steel} />
      ))}
      <Box at={[0, height, 0]} size={[3.9, 0.14, 0.18]} color="#93a2b1" />
    </group>
  )
}

export function Collector() {
  return (
    <group>
      <Box at={[0, 0.05, 0]} size={[3.6, 0.1, 2.6]} color="#d7dee5" />
      <Box at={[0, 0.85, -0.2]} size={[3.0, 1.5, 1.6]} color="#eef2f6" />
      <Box at={[0, 1.65, -0.2]} size={[3.2, 0.12, 1.8]} color="#c3cfda" />
      {[-0.9, 0, 0.9].map((x) => (
        <Box key={x} at={[x, 0.9, 0.62]} size={[0.6, 0.9, 0.03]} color="#cfd9e3" />
      ))}
      <Box
        at={[0, 1.35, 0.62]}
        size={[2.6, 0.06, 0.03]}
        color={PALETTE.grid}
        emissive={PALETTE.grid}
        emissiveIntensity={0.6}
        shadow={false}
      />
    </group>
  )
}

/* ---------------- Storage ---------------- */

export type BessMode = 'charge' | 'discharge' | 'idle' | 'offline' | 'warn'
const MODE_COLOR: Record<BessMode, string> = {
  charge: PALETTE.charge,
  discharge: PALETTE.discharge,
  idle: '#7fc9a8',
  offline: PALETTE.alarm,
  warn: PALETTE.warn,
}

export function BessContainer({ soc, mode, heat }: { soc: number; mode: BessMode; heat: number }) {
  const beacon = useRef<Mesh>(null)
  const ring = useRef<Mesh>(null)
  const fans = useRef<Group>(null)
  const color = MODE_COLOR[mode]
  const active = mode === 'charge' || mode === 'discharge'
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    if (beacon.current) {
      const m = beacon.current.material as MeshStandardMaterial
      m.emissiveIntensity =
        mode === 'offline' || mode === 'warn'
          ? 1.2 + Math.sin(t * 8) * 1.1
          : 0.8 + Math.sin(t * 2) * 0.3
    }
    if (ring.current) {
      const s = 1 + ((t * 0.6) % 1) * 0.35
      ring.current.scale.set(s, s, s)
      ;(ring.current.material as MeshStandardMaterial).opacity = active
        ? 0.45 * (1 - ((t * 0.6) % 1))
        : 0
    }
    if (fans.current && mode !== 'offline')
      for (const fan of fans.current.children) fan.rotation.y += dt * (active ? 9 : 2)
  })
  const body = mode === 'offline' ? '#f6e1df' : PALETTE.white
  const fill = Math.max(0.02, soc / 100)
  return (
    <group>
      <Box at={[0, 0.06, 0]} size={[3.0, 0.12, 2.1]} color="#d5dde5" />
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.14, 0]}>
        <ringGeometry args={[1.55, 1.75, 48]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <Box
        at={[0, 0.84, 0]}
        size={[2.6, 1.42, 1.5]}
        color={body}
        emissive={mode === 'warn' || mode === 'offline' ? PALETTE.alarm : '#000000'}
        emissiveIntensity={heat * 0.35}
      />
      {Array.from({ length: 9 }, (_, i) => (
        <Box
          key={i}
          at={[-1.04 + i * 0.26, 0.84, 0.76]}
          size={[0.035, 1.3, 0.03]}
          color="#d9e1e8"
          shadow={false}
        />
      ))}
      <Box at={[0, 1.58, 0]} size={[2.66, 0.08, 1.56]} color="#dbe3ea" />
      {/* SOC gauge on the front face */}
      <Box at={[1.05, 0.84, 0.77]} size={[0.24, 1.12, 0.02]} color="#1e2a3a" shadow={false} />
      <Box
        at={[1.05, 0.3 + (1.06 * fill) / 2, 0.785]}
        size={[0.18, 1.06 * fill, 0.02]}
        color={color}
        emissive={color}
        emissiveIntensity={1.2}
        shadow={false}
      />
      {/* roof HVAC: units stay fixed, only the fan blades spin about their own hub */}
      {[-0.7, 0.4].map((x) => (
        <group key={x} position={[x, 0, -0.1]}>
          <Box at={[0, 1.75, 0]} size={[0.8, 0.26, 0.8]} color="#e4eaf0" />
          <Cylinder at={[0, 1.89, 0]} r={0.3} h={0.02} color="#9fb0c2" segments={20} />
        </group>
      ))}
      <group ref={fans}>
        {[-0.7, 0.4].map((x) => (
          <group key={x} position={[x, 1.91, -0.1]}>
            <Box size={[0.5, 0.02, 0.08]} color="#6f8296" shadow={false} />
            <Box size={[0.08, 0.02, 0.5]} color="#6f8296" shadow={false} />
          </group>
        ))}
      </group>
      <mesh ref={beacon} position={[1.15, 1.78, 0.6]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1}
          toneMapped={false}
        />
      </mesh>
      {/* PCS skid behind the container */}
      <group position={[0, 0, -1.75]}>
        <Box at={[0, 0.5, 0]} size={[1.3, 0.9, 0.7]} color="#e8edf2" />
        <Box
          at={[0.35, 0.65, 0.36]}
          size={[0.3, 0.06, 0.02]}
          color={color}
          emissive={color}
          emissiveIntensity={active ? 1.4 : 0.3}
          shadow={false}
        />
      </group>
    </group>
  )
}

/* ---------------- Loads ---------------- */

function Smoke({ strength }: { strength: number }) {
  const puffs = useRef<Group>(null)
  useFrame(({ clock }) => {
    const g = puffs.current
    if (!g) return
    g.children.forEach((child, i) => {
      const p = (clock.elapsedTime * 0.25 + i / g.children.length) % 1
      child.position.set(Math.sin(p * 3 + i) * 0.2 + p * 0.8, p * 3, 0)
      const s = (0.25 + p * 0.7) * strength
      child.scale.set(s, s, s)
      const mat = (child as Mesh).material as MeshStandardMaterial
      mat.opacity = (1 - p) * 0.55 * strength
    })
  })
  return (
    <group ref={puffs}>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i}>
          <icosahedronGeometry args={[0.5, 1]} />
          <meshStandardMaterial
            color="#e9edf2"
            transparent
            opacity={0.4}
            depthWrite={false}
            flatShading
          />
        </mesh>
      ))}
    </group>
  )
}

export function Factory({ load, night }: { load: number; night: number }) {
  const lit = night * (0.35 + load / 14)
  return (
    <group>
      <Box at={[0, 0.05, 0]} size={[9.5, 0.1, 6.6]} color="#d9e0e7" />
      <Box at={[-0.8, 1.35, 0.2]} size={[6.4, 2.5, 4.4]} color="#eef2f6" />
      {[-2.9, -1.3, 0.3, 1.9].map((x) => (
        <group key={x} position={[x - 0.8 + 0.8, 2.6, 0.2]}>
          <Box at={[0, 0.35, 0]} size={[1.6, 0.08, 4.4]} rotation={[0, 0, 0.42]} color="#c7d4e0" />
          <Box
            at={[0.68, 0.34, 0]}
            size={[0.06, 0.66, 4.4]}
            color="#8fb5dc"
            emissive="#ffd38a"
            emissiveIntensity={lit}
          />
        </group>
      ))}
      {[-3.2, -1.6, 0, 1.6].map((x) => (
        <Box
          key={x}
          at={[x - 0.8 + 0.8 - 0.8, 1.3, 2.42]}
          size={[1.0, 0.8, 0.03]}
          color="#a9c4dd"
          emissive="#ffd38a"
          emissiveIntensity={lit}
          shadow={false}
        />
      ))}
      <Box at={[-2.2, 0.75, 2.42]} size={[1.4, 1.4, 0.04]} color="#b9c6d2" shadow={false} />
      <Box at={[3.6, 1.7, -0.8]} size={[2.2, 3.3, 2.2]} color="#e7edf3" />
      {[0.9, 1.7, 2.5].map((y) => (
        <Box
          key={y}
          at={[3.6, y, 0.32]}
          size={[1.8, 0.4, 0.03]}
          color="#a9c4dd"
          emissive="#ffd38a"
          emissiveIntensity={lit}
          shadow={false}
        />
      ))}
      <group position={[3.4, 0, 1.8]}>
        <Cylinder at={[0, 2.6, 0]} r={0.32} rTop={0.24} h={5.2} color="#e9eef3" />
        <Cylinder at={[0, 4.7, 0]} r={0.26} h={0.4} color="#f27c6b" />
        <group position={[0, 5.3, 0]}>
          <Smoke strength={Math.min(1, 0.3 + load / 14)} />
        </group>
      </group>
      {[-3.6, -2.2].map((x) => (
        <group key={x} position={[x, 0, 3.1]}>
          <Box at={[0, 0.45, 0]} size={[1.0, 0.75, 0.55]} color="#f2f5f8" />
          <Box at={[0.65, 0.35, 0]} size={[0.4, 0.55, 0.52]} color="#4f7fe8" />
        </group>
      ))}
    </group>
  )
}

function House({ at, rot = 0, lit }: { at: V3; rot?: number; lit: number }) {
  return (
    <group position={at} rotation={[0, rot, 0]}>
      <Box at={[0, 0.55, 0]} size={[1.4, 1.1, 1.2]} color="#f6f2ec" />
      <mesh position={[0, 1.38, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.12, 0.62, 4]} />
        <meshStandardMaterial color="#e48b6b" flatShading roughness={0.8} />
      </mesh>
      <Box
        at={[-0.3, 0.6, 0.61]}
        size={[0.32, 0.32, 0.02]}
        color="#9cc0de"
        emissive="#ffc970"
        emissiveIntensity={lit}
        shadow={false}
      />
      <Box at={[0.3, 0.42, 0.61]} size={[0.26, 0.6, 0.02]} color="#b7a58f" shadow={false} />
    </group>
  )
}

function Car({ at, color }: { at: V3; color: string }) {
  return (
    <group position={at}>
      <Box at={[0, 0.22, 0]} size={[0.62, 0.24, 1.1]} color={color} roughness={0.4} />
      <Box at={[0, 0.42, -0.05]} size={[0.52, 0.2, 0.6]} color="#cfe0f0" roughness={0.3} />
    </group>
  )
}

export function Homes({ load, night }: { load: number; night: number }) {
  const lit = night * (0.4 + load / 5)
  const charger = useRef<Group>(null)
  useFrame(({ clock }) => {
    charger.current?.children.forEach((c, i) => {
      const m = (c as Mesh).material as MeshStandardMaterial
      m.emissiveIntensity = load > 2.5 ? 1 + Math.sin(clock.elapsedTime * 3 + i) * 0.8 : 0.3
    })
  })
  const apartments = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        x: (i % 3) * 0.6 - 0.6,
        y: 0.7 + Math.floor(i / 3) * 0.85,
        on: (i * 7) % 5 !== 0,
      })),
    [],
  )
  return (
    <group>
      <Box at={[0, 0.04, 0]} size={[8.6, 0.08, 7.4]} color="#e3ebe4" shadow={false} />
      <group position={[-2.4, 0, -1.6]}>
        <Box at={[0, 1.8, 0]} size={[2.2, 3.6, 1.9]} color="#f3f0ea" />
        <Box at={[0, 3.66, 0]} size={[2.3, 0.12, 2.0]} color="#d7cfc3" />
        {apartments.map((w, i) => (
          <Box
            key={i}
            at={[w.x, w.y, 0.96]}
            size={[0.38, 0.42, 0.02]}
            color="#9cc0de"
            emissive="#ffc970"
            emissiveIntensity={w.on ? lit : lit * 0.2}
            shadow={false}
          />
        ))}
      </group>
      <House at={[0.6, 0, -2.2]} lit={lit} />
      <House at={[2.6, 0, -1.6]} lit={lit} rot={-0.2} />
      <House at={[0.9, 0, 0.2]} lit={lit} rot={0.15} />
      {/* EV charging hub */}
      <Box at={[1.2, 0.09, 2.5]} size={[5.4, 0.04, 2.2]} color="#cfd8e1" shadow={false} />
      <group ref={charger}>
        {[-1, 0.2, 1.4, 2.6].map((x) => (
          <mesh key={x} position={[x, 0.45, 1.55]} castShadow>
            <boxGeometry args={[0.22, 0.8, 0.18]} />
            <meshStandardMaterial color="#22b07d" emissive="#22b07d" emissiveIntensity={0.4} />
          </mesh>
        ))}
      </group>
      <Car at={[-1, 0, 2.6]} color="#4f7fe8" />
      <Car at={[0.2, 0, 2.6]} color="#f2f4f7" />
      <Car at={[2.6, 0, 2.6]} color="#f27c6b" />
      <Tree at={[-3.6, 0, 1.6]} scale={0.9} />
      <Tree at={[3.6, 0, -0.4]} scale={0.8} />
    </group>
  )
}

/* ---------------- Environment ---------------- */

export const Environment = memo(function Environment() {
  const fenceZ = 11.4
  const roadZ = 14
  const trees: V3[] = [
    ...Array.from({ length: 13 }, (_, i): V3 => [-30 + i * 5, 0, fenceZ + 0.9]),
    [-27, 0, 6],
    [-28, 0, -6],
    [-26, 0, -14],
    [24, 0, -6],
    [25, 0, -14],
    [26, 0, 2],
    [16, 0, -15],
    [-2, 0, -15],
    [-9, 0, -14],
    [-12, 0, -15.5],
  ]
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[260, 260]} />
        <meshStandardMaterial color="#e9eef3" roughness={1} />
      </mesh>
      {/* site pad */}
      <Box at={[0, -0.005, -1]} size={[56, 0.02, 25]} color="#eef2f6" shadow={false} />
      {/* grass verge and road */}
      <Box at={[0, 0.0, fenceZ + 1.1]} size={[120, 0.03, 2.2]} color="#d6eadb" shadow={false} />
      <Box at={[0, 0.0, roadZ + 0.9]} size={[160, 0.03, 4.2]} color="#dde3ea" shadow={false} />
      {Array.from({ length: 30 }, (_, i) => (
        <Box
          key={i}
          at={[-75 + i * 5.2, 0.025, roadZ + 0.9]}
          size={[2.4, 0.01, 0.14]}
          color="#ffffff"
          shadow={false}
        />
      ))}
      {/* fence along the road */}
      <Beam a={[-34, 0.75, fenceZ]} b={[30, 0.75, fenceZ]} r={0.04} color="#c4cdd6" />
      <Beam a={[-34, 0.4, fenceZ]} b={[30, 0.4, fenceZ]} r={0.03} color="#c4cdd6" />
      {Array.from({ length: 33 }, (_, i) => (
        <Box key={i} at={[-34 + i * 2, 0.45, fenceZ]} size={[0.07, 0.9, 0.07]} color="#c4cdd6" />
      ))}
      {/* internal service roads */}
      <Box at={[-1.6, 0.005, 8.6]} size={[34, 0.02, 1.4]} color="#e1e7ed" shadow={false} />
      <Box at={[12.6, 0.005, -1]} size={[1.4, 0.02, 17]} color="#e1e7ed" shadow={false} />
      {trees.map((p, i) => (
        <Tree
          key={i}
          at={p}
          scale={0.9 + ((i * 37) % 5) * 0.08}
          color={i % 3 ? '#8fcfb0' : '#7cc4a2'}
        />
      ))}
    </group>
  )
})

export function Clouds({ amount }: { amount: number }) {
  const group = useRef<Group>(null)
  const clouds = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        x: -40 + i * 13,
        z: -18 + ((i * 11) % 22),
        y: 13 + (i % 3) * 1.5,
        s: 1 + (i % 3) * 0.4,
      })),
    [],
  )
  useFrame((_, dt) => {
    group.current?.children.forEach((c) => {
      c.position.x += dt * 0.6
      if (c.position.x > 45) c.position.x = -45
    })
  })
  const visible = Math.round(amount * clouds.length)
  return (
    <group ref={group}>
      {clouds.slice(0, visible).map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          {[
            [0, 0, 0, 1.4],
            [1.3, -0.2, 0.2, 1.0],
            [-1.3, -0.25, -0.1, 1.05],
            [0.4, 0.5, -0.3, 0.9],
          ].map(([x, y, z, r], k) => (
            <mesh key={k} position={[x, y, z]}>
              <icosahedronGeometry args={[r, 1]} />
              <meshStandardMaterial
                color="#ffffff"
                transparent
                opacity={0.88}
                flatShading
                roughness={1}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}
