import type { CameraPort } from '../learning/lessonTypes'
import {
  useEffect,
  useMemo,
  useRef,
  type ComponentRef,
  type MutableRefObject,
  type RefObject,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import {
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Object3D,
  OrthographicCamera,
  PCFShadowMap,
  Vector3,
} from 'three'
import { EDGES, NODES, NODE_BY_ID } from '../domain/topology'
import type { NodeId, ScenarioId, Snapshot, TopologyEdge } from '../domain/types'
import { Path, catenary, type V3 } from './scene/geometry'
import { daylightAt, smoothstep, type SceneLabel, type Selection } from './scene/shared'
import {
  BessContainer,
  Clouds,
  Collector,
  Environment,
  Factory,
  Gantry,
  Homes,
  LatticeTower,
  PALETTE,
  SolarFarm,
  Substation,
  WindTurbine,
  type BessMode,
} from './scene/models'

export interface SceneProps {
  cameraPort?: RefObject<CameraPort | null>
  cameraRestore?: { state: import('../learning/lessonTypes').CameraState; serial: number }
  /** Retain the scene while an opaque explorer covers it, rendering only changes. */
  paused?: boolean
  snapshot: Snapshot
  /** Fractional minute, advanced every animation frame during playback (visual only). */
  clock: MutableRefObject<number>
  scenario: ScenarioId
  selected: Selection | null
  highlighted: readonly string[]
  onSelect: (selection: Selection) => void
  focus: { key: Selection | 'overview'; serial: number }
  zoomCmd: { dir: 1 | -1; serial: number }
  autoRotate: boolean
  reducedMotion: boolean
  labels: readonly SceneLabel[]
}

const OVERVIEW_TARGET: V3 = [0, 0, -2.5]
const CAMERA_OFFSET: V3 = [24, 38, 40]
const TOWER_H = 6.2
const WIRE_Y = TOWER_H - 1.55
const GANTRY_H = 3.2
const MID_TOWER: V3 = [4, 0, -12.8]
const GANTRY: V3 = [-0.2, 0, -10]
// Conductors run from the utility tower to the PCC gantry; cross-arms are perpendicular to them.
const LINE_DIR = new Vector3(
  GANTRY[0] - NODE_BY_ID.grid.position[0],
  0,
  GANTRY[2] - NODE_BY_ID.grid.position[2],
).normalize()
const PERP: [number, number] = [-LINE_DIR.z, LINE_DIR.x]
const ARM_ROT = Math.atan2(-PERP[1], PERP[0])
const PHASES = [-1.5, 0, 1.5]
const wirePoint = (base: V3, y: number, o: number): V3 => [
  base[0] + PERP[0] * o,
  y,
  base[2] + PERP[1] * o,
]

function focusOf(key: Selection | 'overview'): { target: V3; factor: number } {
  if (key === 'overview') return { target: OVERVIEW_TARGET, factor: 1 }
  if (key === 'bess-cluster') return { target: [2.5, 1, 4.6], factor: 2.2 }
  const n = NODE_BY_ID[key]
  const [x, , z] = n.position
  const factor: Record<string, number> = {
    pv: 2.0,
    wind: 2.0,
    bess: 2.3,
    grid: 1.8,
    transformer: 2.7,
    bus: 2.9,
    factory: 2.1,
    residential: 2.2,
  }
  const y = n.kind === 'wind' ? 4 : n.kind === 'grid' ? 3 : 1
  return { target: [x, y, z], factor: factor[n.kind] }
}

function selectionBox(key: Selection): { center: V3; size: V3 } {
  if (key === 'bess-cluster') return { center: [2.5, 1.2, 4.5], size: [14.4, 2.6, 5] }
  const n = NODE_BY_ID[key]
  const [x, , z] = n.position
  switch (n.kind) {
    case 'pv':
      return { center: [x, 0.8, z], size: [12.2, 1.8, 10.6] }
    case 'wind':
      return { center: [x, 4.4, z], size: [2.6, 9, 2.6] }
    case 'bess':
      return { center: [x, 1.1, z - 0.7], size: [3.3, 2.3, 4.0] }
    case 'grid':
      return { center: [x, 3.2, z], size: [3.6, 6.6, 3.6] }
    case 'factory':
      return { center: [x, 2.4, z], size: [10, 5, 7] }
    case 'residential':
      return { center: [x, 1.9, z], size: [9, 4, 7.8] }
    case 'bus':
      return { center: [x, 1, z], size: [4, 2.2, 3] }
    default:
      return {
        center: [x, 1, z],
        size: key === 'lv' ? [2.6, 2.2, 2.2] : key === 'pcc' ? [5.6, 3.8, 4] : [4.6, 2.2, 4],
      }
  }
}

const SKY = {
  night: new Color('#16213a'),
  day: new Color('#e6edf5'),
  gold: new Color('#f6cfae'),
  overcast: new Color('#cfd6df'),
}

function Sky({ clock, cloudy }: { clock: MutableRefObject<number>; cloudy: boolean }) {
  const { scene } = useThree()
  const sun = useRef<DirectionalLight>(null)
  const moon = useRef<DirectionalLight>(null)
  const hemi = useRef<HemisphereLight>(null)
  const bg = useMemo(() => new Color(), [])
  const warm = useMemo(() => new Color(), [])
  useEffect(() => {
    scene.fog = new Fog('#e6edf5', 75, 150)
    return () => {
      scene.fog = null
    }
  }, [scene])
  useFrame(() => {
    const h = clock.current / 60
    const elev = Math.sin((Math.PI * (h - 6)) / 12)
    const day = smoothstep(-0.12, 0.3, elev)
    const golden = Math.exp(-(((elev - 0.06) / 0.17) ** 2))
    bg.copy(SKY.night)
      .lerp(SKY.day, day)
      .lerp(SKY.gold, golden * 0.45)
    if (cloudy) bg.lerp(SKY.overcast, 0.45 * day)
    scene.background = bg
    if (scene.fog instanceof Fog) scene.fog.color.copy(bg)
    if (sun.current) {
      const az = (Math.PI * (h - 6)) / 12
      sun.current.position.set(-Math.cos(az) * 40, Math.max(4, elev * 46), 26)
      sun.current.intensity = (cloudy ? 1.1 : 2.7) * day
      warm.set('#ffffff').lerp(new Color('#ffb27a'), golden * 0.8)
      sun.current.color.copy(warm)
    }
    if (moon.current) moon.current.intensity = 0.55 * (1 - day)
    if (hemi.current) hemi.current.intensity = 0.45 + (cloudy ? 1.25 : 1.05) * day
  })
  return (
    <>
      <hemisphereLight ref={hemi} args={['#f4f8ff', '#c9d3de', 1.4]} />
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-38}
        shadow-camera-right={38}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-far={140}
        shadow-bias={-0.0006}
      />
      <directionalLight ref={moon} position={[20, 30, -10]} color="#8fa8ff" />
    </>
  )
}

/* ---------------- Energy flow ---------------- */

function edgeTone(edge: TopologyEdge, power: number) {
  if (edge.to.startsWith('bess')) return power >= 0 ? PALETTE.charge : PALETTE.discharge
  if (edge.from === 'pv' || edge.from.startsWith('wind')) return PALETTE.renewable
  return PALETTE.grid
}

function edgePath(edge: TopologyEdge): Path {
  if (edge.id === 'grid-pcc') {
    const grid = NODE_BY_ID.grid.position as V3
    return new Path([
      ...catenary(wirePoint(grid, WIRE_Y, 0), wirePoint(MID_TOWER, WIRE_Y, 0), 0.9),
      ...catenary(wirePoint(MID_TOWER, WIRE_Y, 0), wirePoint(GANTRY, GANTRY_H, 0), 0.7).slice(1),
      new Vector3(GANTRY[0], 0.08, GANTRY[2]),
      new Vector3(...NODE_BY_ID.pcc.position).setY(0.08),
    ])
  }
  const a = NODE_BY_ID[edge.from].position,
    b = NODE_BY_ID[edge.to].position
  const pts: Vector3[] = [new Vector3(a[0], 0.08, a[2])]
  for (const [x, z] of edge.route ?? []) pts.push(new Vector3(x, 0.08, z))
  pts.push(new Vector3(b[0], 0.08, b[2]))
  return new Path(pts)
}

const MAX_PARTICLES = 18
function FlowParticles({
  path,
  power,
  color,
  animate,
}: {
  path: Path
  power: number
  color: string
  animate: boolean
}) {
  const ref = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const pos = useMemo(() => new Vector3(), [])
  const dir = useMemo(() => new Vector3(), [])
  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const p = Math.abs(power)
    const n = p < 0.01 ? 0 : Math.min(MAX_PARTICLES, Math.round(3 + p * 1.1))
    const speed = (2 + Math.min(p, 16) * 0.28) / path.length
    const t = animate ? clock.elapsedTime : 0
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (i < n) {
        let s = (t * speed + i / n) % 1
        if (power < 0) s = 1 - s
        path.at(s, pos, dir)
        dummy.position.copy(pos)
        dummy.lookAt(pos.clone().addScaledVector(dir, power < 0 ? -1 : 1))
        const fade = Math.min(1, s * 8, (1 - s) * 8)
        dummy.scale.set(1, 1, 0.4 + fade * 0.6)
      } else dummy.scale.set(0, 0, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX_PARTICLES]} frustumCulled={false}>
      <boxGeometry args={[0.16, 0.12, 0.5]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </instancedMesh>
  )
}

function Trench({ path }: { path: Path }) {
  return (
    <group>
      {path.points.slice(1).map((b, i) => {
        const a = path.points[i]
        if (a.y > 0.5 || b.y > 0.5) return null
        const len = a.distanceTo(b)
        return (
          <mesh
            key={i}
            position={[(a.x + b.x) / 2, 0.025, (a.z + b.z) / 2]}
            rotation={[0, Math.atan2(b.x - a.x, b.z - a.z), 0]}
            receiveShadow
          >
            <boxGeometry args={[0.36, 0.03, len + 0.36]} />
            <meshStandardMaterial color="#d3dbe4" roughness={1} />
          </mesh>
        )
      })}
    </group>
  )
}

function Flows({
  snapshot,
  highlighted,
  animate,
}: {
  snapshot: Snapshot
  highlighted: readonly string[]
  animate: boolean
}) {
  const paths = useMemo(() => Object.fromEntries(EDGES.map((e) => [e.id, edgePath(e)])), [])
  const anyHighlight = highlighted.length > 0
  return (
    <group>
      {EDGES.map((edge) => {
        const power = snapshot.edges[edge.id].powerMW
        const color = edgeTone(edge, power)
        const active = Math.abs(power) > 0.01
        const lit = highlighted.includes(edge.id)
        const path = paths[edge.id]
        return (
          <group key={edge.id}>
            <Trench path={path} />
            {active && (
              <Line
                points={path.points.map((p) => [p.x, p.y + 0.03, p.z] as V3)}
                color={color}
                lineWidth={lit ? 5 : 2.6}
                transparent
                opacity={anyHighlight && !lit ? 0.25 : lit ? 0.95 : 0.6}
              />
            )}
            {active && <FlowParticles path={path} power={power} color={color} animate={animate} />}
          </group>
        )
      })}
    </group>
  )
}

/* ---------------- Selection brackets ---------------- */

function Brackets({ selection }: { selection: Selection }) {
  const group = useRef<Group>(null)
  const { center, size } = selectionBox(selection)
  const segments = useMemo(() => {
    const [w, h, d] = size.map((v) => v / 2)
    const k = Math.min(w, h, d, 1.4) * 0.55
    const out: V3[][] = []
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1]) {
          const c: V3 = [sx * w, sy * h, sz * d]
          out.push([c, [c[0] - sx * k, c[1], c[2]]])
          out.push([c, [c[0], c[1] - sy * k, c[2]]])
          out.push([c, [c[0], c[1], c[2] - sz * k]])
        }
    return out
  }, [size])
  useFrame(({ clock }) => {
    const s = 1 + Math.sin(clock.elapsedTime * 3) * 0.02
    group.current?.scale.set(s, s, s)
  })
  return (
    <group ref={group} position={center}>
      {segments.map((pts, i) => (
        <Line key={i} points={pts} color="#2f6bff" lineWidth={2.4} />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -center[1] + 0.05, 0]}>
        <planeGeometry args={[size[0], size[2]]} />
        <meshBasicMaterial color="#2f6bff" transparent opacity={0.07} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ---------------- Camera ---------------- */

function CameraRig({
  cameraPort,
  cameraRestore,
  focus,
  zoomCmd,
  autoRotate,
}: {
  cameraPort?: SceneProps['cameraPort']
  cameraRestore?: SceneProps['cameraRestore']
  focus: SceneProps['focus']
  zoomCmd: SceneProps['zoomCmd']
  autoRotate: boolean
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const { camera, size } = useThree()
  const anim = useRef<{ from: Vector3; to: Vector3; z0: number; z1: number; t: number } | null>(
    null,
  )
  const desktop = size.width > 900
  const fit = desktop
    ? Math.min(size.width / 84, size.height / 47)
    : Math.min(size.width / 50, size.height / 34)
  // Shift the projection so the focus point lands in the free area between the floating panels.
  useEffect(() => {
    const cam = camera as OrthographicCamera
    if (desktop) cam.setViewOffset(size.width, size.height, 150, 0, size.width, size.height)
    else cam.clearViewOffset()
    cam.updateProjectionMatrix()
  }, [camera, size.width, size.height, desktop])
  const start = (to: V3, zoom: number) => {
    const c = controls.current
    if (!c) return
    anim.current = {
      from: c.target.clone(),
      to: new Vector3(...to),
      z0: (camera as OrthographicCamera).zoom,
      z1: zoom,
      t: 0,
    }
  }
  useEffect(() => {
    const f = focusOf(focus.key)
    // Fit the first view immediately. An intro fly-in competes with worker result
    // delivery and is especially costly before the initial shader compilation.
    if (focus.serial === 0 && controls.current) {
      controls.current.target.set(...f.target)
      const cam = camera as OrthographicCamera
      cam.zoom = fit * f.factor
      cam.updateProjectionMatrix()
      controls.current.update()
      anim.current = null
      return
    }
    start(f.target, fit * f.factor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.serial, fit])
  useEffect(() => {
    if (!zoomCmd.serial || !controls.current) return
    const z = (camera as OrthographicCamera).zoom * (zoomCmd.dir > 0 ? 1.3 : 1 / 1.3)
    start(controls.current.target.toArray() as V3, Math.max(fit * 0.6, Math.min(fit * 5, z)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomCmd.serial])
  useEffect(() => {
    if (!cameraPort) return
    cameraPort.current = {
      capture: () =>
        controls.current
          ? {
              position: camera.position.toArray() as V3,
              target: controls.current.target.toArray() as V3,
              zoom: (camera as OrthographicCamera).zoom,
            }
          : null,
      restore: (state) => {
        const c = controls.current
        if (!c) return
        anim.current = null
        // Flush damping before restoring the saved orbit, target and orthographic zoom.
        const damping = c.enableDamping
        c.enableDamping = false
        c.update()
        c.enableDamping = damping
        camera.position.set(...state.position)
        c.target.set(...state.target)
        ;(camera as OrthographicCamera).zoom = state.zoom
        camera.updateProjectionMatrix()
        c.update()
      },
    }
    return () => {
      cameraPort.current = null
    }
  }, [camera, cameraPort])
  // Restore in the same R3F commit, after focus/zoom effects. A DOM requestAnimationFrame
  // can run before the canvas applies its new focus and be overwritten by that effect.
  useEffect(() => {
    if (cameraRestore) cameraPort?.current?.restore(cameraRestore.state)
  }, [cameraRestore, cameraPort])
  useFrame((_, dt) => {
    const a = anim.current,
      c = controls.current
    if (!a || !c) return
    a.t = Math.min(1, a.t + dt / 1.2)
    const e = a.t < 0.5 ? 4 * a.t ** 3 : 1 - (-2 * a.t + 2) ** 3 / 2
    const offset = camera.position.clone().sub(c.target)
    c.target.lerpVectors(a.from, a.to, e)
    camera.position.copy(c.target).add(offset)
    const cam = camera as OrthographicCamera
    cam.zoom = a.z0 + (a.z1 - a.z0) * e
    cam.updateProjectionMatrix()
    c.update()
    if (a.t >= 1) anim.current = null
  })
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={OVERVIEW_TARGET}
      enableDamping
      dampingFactor={0.08}
      autoRotate={autoRotate}
      autoRotateSpeed={0.5}
      minZoom={fit * 0.6}
      maxZoom={fit * 5}
      minPolarAngle={0.35}
      maxPolarAngle={1.2}
      onStart={() => {
        anim.current = null
      }}
    />
  )
}

/* ---------------- Labels ---------------- */

function LabelProjector({
  labels,
  refs,
}: {
  labels: readonly SceneLabel[]
  refs: RefObject<Record<string, HTMLDivElement | null>>
}) {
  const point = useMemo(() => new Vector3(), [])
  useFrame(({ camera, size }) => {
    for (const label of labels) {
      const el = refs.current?.[label.key]
      if (!el) continue
      point.set(...label.anchor).project(camera)
      const x = ((point.x + 1) * size.width) / 2
      const y = ((1 - point.y) * size.height) / 2
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`
      el.style.opacity = point.z < -1 || point.z > 1 ? '0' : '1'
    }
  })
  return null
}

/* ---------------- World ---------------- */

function World(props: SceneProps) {
  const { snapshot, selected, onSelect, reducedMotion, scenario } = props
  const animate = !reducedMotion
  const parameters = snapshot.parameters
  const night = 1 - daylightAt(snapshot.minute)
  const pick = (id: Selection) => ({
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation()
      onSelect(id)
    },
    onPointerOver: () => (document.body.style.cursor = 'pointer'),
    onPointerOut: () => (document.body.style.cursor = 'auto'),
  })
  const warnNode = snapshot.alarms.find((a) => a.severity === 'warning')?.nodeId
  const bessMode = (id: NodeId): BessMode => {
    const s = snapshot.nodes[id]
    if (s.status === 'offline') return 'offline'
    if (warnNode === id) return 'warn'
    if (s.injectionMW > 0.01) return 'discharge'
    if (s.injectionMW < -0.01) return 'charge'
    return 'idle'
  }
  const grid = NODE_BY_ID.grid.position as V3
  return (
    <>
      <Sky clock={props.clock} cloudy={scenario === 'cloudy'} />
      <Environment />
      <Clouds amount={scenario === 'cloudy' ? 1 : 0.3} />
      {snapshot && <Flows snapshot={snapshot} highlighted={props.highlighted} animate={animate} />}

      {/* External grid: two lattice towers and a gantry, conductors only on this 110 kV span */}
      <group position={grid} rotation={[0, ARM_ROT, 0]} {...pick('grid')}>
        <LatticeTower height={TOWER_H} />
      </group>
      <group position={MID_TOWER} rotation={[0, ARM_ROT, 0]}>
        <LatticeTower height={TOWER_H} />
      </group>
      <group position={GANTRY} rotation={[0, ARM_ROT, 0]}>
        <Gantry height={GANTRY_H} />
      </group>
      {PHASES.map((o) => (
        <group key={o}>
          <Line
            points={catenary(wirePoint(grid, WIRE_Y, o), wirePoint(MID_TOWER, WIRE_Y, o), 0.9)}
            color="#8796a6"
            lineWidth={1.2}
          />
          <Line
            points={catenary(
              wirePoint(MID_TOWER, WIRE_Y, o),
              wirePoint(GANTRY, GANTRY_H, o * 1.2),
              0.7,
            )}
            color="#8796a6"
            lineWidth={1.2}
          />
        </group>
      ))}

      {NODES.map((node) => {
        const [x, , z] = node.position
        const state = snapshot.nodes[node.id]
        let model = null
        switch (node.kind) {
          case 'pv':
            model = <SolarFarm output={state.injectionMW} ratedMW={parameters.pvDCMWp / 1.25} />
            break
          case 'wind':
            model = (
              <WindTurbine
                output={animate ? state.injectionMW : 0}
                ratedMW={parameters.windMW / 3}
              />
            )
            break
          case 'bess':
            model = (
              <BessContainer
                soc={state.socPct ?? 0}
                mode={bessMode(node.id)}
                heat={Math.min(1, Math.max(0, ((state.temperatureC ?? 30) - 35) / 25))}
              />
            )
            break
          case 'factory':
            model = <Factory load={-state.injectionMW} night={night} />
            break
          case 'residential':
            model = <Homes load={-state.injectionMW} night={night} />
            break
          case 'bus':
            model = <Collector />
            break
          case 'transformer':
            model = <Substation variant={node.id as 'pcc' | 'distribution' | 'lv'} />
            break
          default:
            return null
        }
        return (
          <group key={node.id} position={[x, 0, z]} {...pick(node.id)}>
            {model}
          </group>
        )
      })}
      {selected && <Brackets selection={selected} />}
      <CameraRig
        cameraPort={props.cameraPort}
        cameraRestore={props.cameraRestore}
        focus={props.focus}
        zoomCmd={props.zoomCmd}
        autoRotate={props.autoRotate && !props.paused}
      />
    </>
  )
}

export default function EnergyScene(props: SceneProps) {
  const refs = useRef<Record<string, HTMLDivElement | null>>({})
  return (
    <>
      <Canvas
        frameloop={props.paused ? 'demand' : 'always'}
        shadows={{ type: PCFShadowMap }}
        orthographic
        camera={{
          position: [
            OVERVIEW_TARGET[0] + CAMERA_OFFSET[0],
            OVERVIEW_TARGET[1] + CAMERA_OFFSET[1],
            OVERVIEW_TARGET[2] + CAMERA_OFFSET[2],
          ],
          zoom: 20,
          near: -200,
          far: 400,
        }}
        dpr={[1, 2]}
        onPointerMissed={() => (document.body.style.cursor = 'auto')}
      >
        <World {...props} />
        <LabelProjector labels={props.labels} refs={refs} />
      </Canvas>
      <div className="label-layer" aria-hidden={false}>
        {props.labels.map((label) => (
          <div
            key={label.key}
            className="label-anchor"
            ref={(el) => {
              refs.current[label.key] = el
            }}
          >
            <button
              className={`scene-chip${label.selected ? ' is-selected' : ''}${label.alert ? ' is-alert' : ''}`}
              style={{ ['--tone' as string]: label.tone }}
              onClick={label.onClick}
            >
              <i />
              <span>{label.name}</span>
              <b>{label.value}</b>
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
