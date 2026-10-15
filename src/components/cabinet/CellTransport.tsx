import { useEffect, useRef, type RefObject } from 'react'
import { useI18n } from '../../i18n'
import { cellCamera, worldAnchor as anchor, type CellOrbit } from './cellView'

export type CellFlowMode = 'discharge' | 'charge'
type Point = readonly [number, number, number]
const positive = anchor('positive-electrode'),
  separator = anchor('separator'),
  negative = anchor('negative-electrode')
const positiveTab = anchor('positive-tab'),
  negativeTab = anchor('negative-tab')
// Schematic transport overlay anchored to the expanded physical surfaces.
// Every route is stored positive -> negative; discharge traverses it in reverse.
const ions: Point[] = [positive, separator, negative].map(([x, y]) => [x, y, 40.06976744186])
const electrons: Point[] = [
  positiveTab,
  [positiveTab[0], positiveTab[1], 174.95348837209],
  [negativeTab[0], negativeTab[1], 174.95348837209],
  negativeTab,
]
const routes = { ions, electrons }
const routeLengths = new Map(
  Object.values(routes).map((points) => [
    points,
    points.slice(1).map((p, i) => Math.hypot(...p.map((v, j) => v - points[i][j]))),
  ]),
)
function sample(points: Point[], fraction: number, orbit: CellOrbit) {
  const lengths = routeLengths.get(points)!
  let distance = fraction * lengths.reduce((a, b) => a + b, 0)
  let index = 0
  while (index < lengths.length - 1 && distance > lengths[index]) distance -= lengths[index++]
  const a = points[index],
    b = points[index + 1],
    t = distance / lengths[index]
  const project = cellCamera(1, orbit).project
  const point = project([
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ]),
    from = project(a),
    to = project(b)
  return {
    x: point[0],
    y: point[1],
    angle: (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI,
  }
}
const d = (points: Point[], orbit: CellOrbit) =>
  points
    .map((point, i) => {
      const [x, y] = cellCamera(1, orbit).project(point)
      return `${i ? 'L' : 'M'}${x} ${y}`
    })
    .join(' ')

export function CellTransport({
  mode,
  playing,
  reduced,
  visible,
  orbit,
}: {
  mode: CellFlowMode
  playing: boolean
  reduced: boolean
  visible: boolean
  orbit: RefObject<CellOrbit>
}) {
  const { t } = useI18n(),
    copy = t.cabinet.flow
  const root = useRef<SVGGElement>(null)
  const phase = useRef(0.23)
  const particles = useRef(new Map<string, SVGGElement>())
  const direction = mode === 'charge' ? 1 : -1
  useEffect(() => {
    let raf = 0,
      last = 0,
      inView = true
    const routeNodes = root.current?.querySelectorAll('[data-route]')
    const arrowNodes = root.current?.querySelectorAll('[data-arrow]')
    const contactNodes = root.current?.querySelectorAll('[data-contact]')
    const device = root.current?.querySelector('.cell-circuit-device')
    const caption = root.current?.querySelector('.cell-flow-caption')
    let previousCamera: ReturnType<typeof cellCamera> | undefined
    const draw = () => {
      root.current?.setAttribute('data-phase', phase.current.toFixed(6))
      const view = orbit.current
      const camera = cellCamera(1, view)
      const project = camera.project
      // Only particles move during steady playback. Reproject static paths on camera changes.
      if (previousCamera !== camera) {
        previousCamera = camera
        routeNodes?.forEach((node) => {
          const kind = node.getAttribute('data-route') as keyof typeof routes
          node.setAttribute('d', d(routes[kind], view))
        })
        arrowNodes?.forEach((node) => {
          const [kind, index] = node.getAttribute('data-arrow')!.split(':')
          const fraction = (kind === 'ions' ? [0.12, 0.62] : [0.3, 0.7])[Number(index)]
          const p = sample(routes[kind as keyof typeof routes], fraction, view)
          node.setAttribute(
            'transform',
            `translate(${p.x} ${p.y}) rotate(${p.angle + (direction < 0 ? 180 : 0)})`,
          )
        })
        contactNodes?.forEach((node, i) => {
          const p = project([positiveTab, negativeTab][i])
          node.setAttribute('cx', String(p[0]))
          node.setAttribute('cy', String(p[1]))
        })
        const centre = project([
          (electrons[1][0] + electrons[2][0]) / 2,
          (electrons[1][1] + electrons[2][1]) / 2,
          electrons[1][2],
        ])
        device?.setAttribute('transform', `translate(${centre[0] - 450} ${centre[1] - 50})`)
        caption?.setAttribute('transform', `translate(${centre[0] - 450} ${centre[1] - 50})`)
      }
      for (const kind of ['ions', 'electrons'] as const) {
        for (let i = 0; i < 4; i++) {
          const point = sample(routes[kind], (phase.current + i / 4) % 1, view)
          particles.current
            .get(`${kind}-${i}`)
            ?.setAttribute('transform', `translate(${point.x} ${point.y})`)
        }
      }
    }
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.08) : 0
      last = now
      phase.current = (phase.current + (direction * dt) / 7 + 1) % 1
      draw()
      raf = requestAnimationFrame(tick)
    }
    const resume = () => {
      cancelAnimationFrame(raf)
      last = 0
      const running = playing && !reduced && visible && inView && !document.hidden
      root.current?.setAttribute('data-running', String(running))
      if (running) raf = requestAnimationFrame(tick)
    }
    draw()
    resume()
    const observer = new IntersectionObserver((entries) => {
      inView = entries[entries.length - 1].isIntersecting
      resume()
    })
    if (root.current?.ownerSVGElement) observer.observe(root.current.ownerSVGElement)
    const figure = root.current?.ownerSVGElement
    figure?.addEventListener('cell-view-change', draw)
    document.addEventListener('visibilitychange', resume)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      figure?.removeEventListener('cell-view-change', draw)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [direction, playing, reduced, visible, orbit])
  return (
    <g ref={root} className="cell-transport" data-mode={mode} aria-hidden="true">
      {(['ions', 'electrons'] as const).map((kind) => (
        <g key={kind} className={`cell-flow-${kind}`}>
          <path className="cell-flow-route" d={d(routes[kind], orbit.current)} data-route={kind} />
          {(kind === 'ions' ? [0.12, 0.62] : [0.3, 0.7]).map((fraction, index) => {
            const p = sample(routes[kind], fraction, orbit.current)
            return (
              <path
                key={fraction}
                className="cell-flow-arrow"
                data-arrow={`${kind}:${index}`}
                d="M-7 -5 L0 0 L-7 5"
                transform={`translate(${p.x} ${p.y}) rotate(${p.angle + (direction < 0 ? 180 : 0)})`}
              />
            )
          })}
          {[0, 1, 2, 3].map((i) => (
            <g
              key={i}
              data-particle={`${kind}-${i}`}
              ref={(node) => {
                if (node) particles.current.set(`${kind}-${i}`, node)
                else particles.current.delete(`${kind}-${i}`)
              }}
            >
              <circle r={kind === 'ions' ? 10 : 8} />
              <text textAnchor="middle" dy="0.35em">
                {kind === 'ions' ? copy.ionSymbol : copy.electronSymbol}
              </text>
            </g>
          ))}
        </g>
      ))}
      {[positiveTab, negativeTab].map((point, i) => (
        <circle
          key={i}
          data-contact={i}
          cx={cellCamera(1, orbit.current).project(point)[0]}
          cy={cellCamera(1, orbit.current).project(point)[1]}
          r={3}
          className="cell-flow-contact"
        />
      ))}
      <g className="cell-circuit-device">
        <rect x={394} y={33} width={112} height={34} rx={5} />
        <text x={450} y={54} textAnchor="middle">
          {copy[mode].device}
        </text>
      </g>
      <text x={450} y={20} textAnchor="middle" className="cell-flow-caption">
        {copy.external}
      </text>
    </g>
  )
}
