import { useEffect, useId, useRef, useState } from 'react'
import { Pause, Play, Sun, Wind } from 'lucide-react'
import { useI18n } from '../../i18n'
import geometry from './geometry.json'

import {
  fullWindStreams,
  windStreams,
  windSegment,
  sunlightOrigin,
  sunlightRays,
  beamPolygon,
  cellCircuit,
  cellLoad,
  cellLanes,
  offsetTransform,
  GEAR_RATIO,
  ROTOR_RATE,
  lerpPoint,
  pathOf,
  polylineSampler,
  rotorPlane,
  shaftStripe,
} from './generationModel'
import './principles.css'

type Kind = 'pv' | 'wind'
type Paths = { fill: string; shades: string[]; top: string; outline: string; crease: string }
const circuitAt = polylineSampler(cellCircuit)
const clamp = (v: number) => Math.max(0, Math.min(1, v))
const cells = Array.from({ length: 5 }, (_, i) => i)
const coating = geometry.pvCell.parts.find((p) => p.id === 'coating')!
const electrons = Array.from({ length: 7 }, (_, i) => i)
const shafts = [
  { x0: 0, x1: 12, r: 5, rate: 1 },
  { x0: 20, x1: 36, r: 5, rate: 1 },
  { x0: 44, x1: 55, r: 5, rate: 1 },
  { x0: 91, x1: 100, r: 2.5, rate: GEAR_RATIO },
  { x0: 102, x1: 115, r: 2.5, rate: GEAR_RATIO },
]
function Solid({ paths, material, id }: { paths: Paths; material?: string; id: string }) {
  return (
    <g className="iso-solid principle-solid" data-material={material} data-solid={id}>
      <path className="iso-fill" d={paths.fill} fillRule="evenodd" />
      {paths.shades.map((d, i) => d && <path key={i} d={d} className="iso-shade" data-shade={i} />)}
      <path className="iso-top" d={paths.top} />
      <path className="iso-line iso-edge" data-tone="mid" d={paths.outline} />
      <path className="iso-line iso-crease" data-tone="lo" d={paths.crease} />
    </g>
  )
}
function Charge({ symbol, kind }: { symbol: string; kind: string }) {
  return (
    <g className={`charge charge-${kind}`}>
      <circle r="10" />
      <text textAnchor="middle" dominantBaseline="central">
        {symbol}
      </text>
    </g>
  )
}

export function useGeneration(kind: Kind, ready: boolean, overview = false) {
  const [playing, setPlaying] = useState(overview),
    [source, setSource] = useState(true)
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const figure = useRef<SVGGElement>(null),
    clock = useRef(0),
    refs = useRef(new Map<string, SVGElement>())
  useEffect(() => {
    if (!ready) setPlaying(false)
    else if (overview) setPlaying(true)
  }, [ready, overview])
  const ref = (name: string) => (node: SVGElement | null) => {
    if (node) refs.current.set(name, node)
    else refs.current.delete(name)
  }
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    let frame = 0,
      last = 0,
      visible = false
    const root = figure.current!
    if (kind === 'pv' && !source) clock.current = 0
    const move = (id: string, point: readonly number[], opacity = 1) => {
      const el = refs.current.get(id)
      if (el) {
        el.setAttribute('transform', `translate(${point[0]} ${point[1]})`)
        el.style.opacity = String(opacity)
      }
    }
    const paint = () => {
      const time = reduced ? 2.5 : clock.current
      root.dataset.clock = clock.current.toFixed(4)
      if (kind === 'pv') {
        let absorption = 0
        cellLanes.forEach((lane, i) => {
          const age = time - i * 0.42,
            phase = (((age % 4) + 4) % 4) / 4
          const photon = clamp(phase / 0.34),
            separation = clamp((phase - 0.34) / 0.5)
          const present = source && age >= 0
          const burst =
            present && !reduced && phase >= 0.34 && phase < 0.5
              ? Math.sin(((phase - 0.34) / 0.16) * Math.PI)
              : 0
          absorption = Math.max(absorption, burst)
          const ring = refs.current.get(`absorb-${i}`)!
          ring.style.opacity = String(burst * 0.8)
          ring.setAttribute(
            'transform',
            `translate(${lane.photon[1].join(' ')}) scale(${0.65 + clamp((phase - 0.34) / 0.16) * 1.1})`,
          )
          ring.dataset.strength = burst.toFixed(3)

          move(
            `photon-${i}`,
            lerpPoint(lane.photon[0], lane.photon[1], reduced ? 0.55 : photon),
            present && (reduced || phase < 0.34)
              ? reduced
                ? 1
                : Math.min(1, photon * 8) * Math.min(1, (1 - photon) * 10)
              : 0,
          )
          move(
            `electron-${i}`,
            lerpPoint(lane.electron[0], lane.electron[1], reduced ? 0.65 : separation),
            present && (reduced || (phase >= 0.34 && phase < 0.9))
              ? reduced
                ? 1
                : Math.min(1, separation * 14) * clamp((0.9 - phase) / 0.08)
              : 0,
          )
          move(
            `hole-${i}`,
            lerpPoint(lane.hole[0], lane.hole[1], reduced ? 0.65 : separation),
            present && (reduced || (phase >= 0.34 && phase < 0.9))
              ? reduced
                ? 1
                : Math.min(1, separation * 14) * clamp((0.9 - phase) / 0.08)
              : 0,
          )
        })
        root.dataset.absorption = absorption.toFixed(3)
        electrons.forEach((i) =>
          move(
            `external-${i}`,
            circuitAt(time * 0.09 + i / 7),
            source && (reduced || time > 1.36) ? 1 : 0,
          ),
        )
      } else {
        ;(overview ? fullWindStreams : windStreams).forEach((stream, i) => {
          const phase = reduced ? 0.48 : (time * 0.28 + stream.phase) % 1
          const el = refs.current.get(`wind-${i}`)!
          el.setAttribute('d', windSegment(stream.points, phase))
          el.style.opacity = String(
            source ? (reduced ? 0.55 : Math.sin(phase * Math.PI) * 0.98) : 0,
          )
          el.dataset.phase = phase.toFixed(4)
        })
        const angle = reduced ? 0.5 : time * ROTOR_RATE,
          fast = angle * GEAR_RATIO
        root.dataset.rotorPhase = angle.toFixed(5)
        root.dataset.generatorPhase = fast.toFixed(5)
        refs.current.get('rotor')?.setAttribute('transform', `rotate(${(angle * 180) / Math.PI})`)
        refs.current
          .get('generator')
          ?.setAttribute('transform', `rotate(${(fast * 180) / Math.PI})`)
        if (!overview)
          shafts.forEach((shaft, i) => {
            for (let j = 0; j < 3; j++) {
              const mark = shaftStripe(
                shaft.x0,
                shaft.x1,
                shaft.r,
                angle * shaft.rate + (j * Math.PI * 2) / 3,
              )
              const el = refs.current.get(`shaft-${i}-${j}`)!
              el.setAttribute('d', mark.d)
              el.style.opacity = mark.visible ? '1' : '0'
            }
          })
        const points = Array.from({ length: 81 }, (_, i) => [
          i * 2,
          18 - (source ? Math.sin((i / 80) * Math.PI * 4 - fast) * 12 : 0),
        ])
        refs.current.get('ac')?.setAttribute('d', pathOf(points))
      }
    }
    const tick = (now: number) => {
      frame = 0
      if (!ready || !visible || document.hidden || !playing || !source || reduced) return
      if (last) clock.current += Math.min(1 / 30, (now - last) / 1000)
      last = now
      paint()
      frame = requestAnimationFrame(tick)
    }
    const resume = () => {
      cancelAnimationFrame(frame)
      frame = 0
      last = 0
      paint()
      const run = ready && visible && !document.hidden && playing && source && !reduced
      root.dataset.running = String(run)
      if (run) frame = requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting
      resume()
    })
    observer.observe(root)
    document.addEventListener('visibilitychange', resume)
    resume()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', resume)
    }
  }, [kind, playing, source, reduced, ready, overview])
  return { kind, ready, overview, playing, setPlaying, source, setSource, reduced, figure, ref }
}
type Controller = ReturnType<typeof useGeneration>

export function GenerationControls({ controller }: { controller: Controller }) {
  const { t } = useI18n(),
    common = t.renewables.principle
  const { kind, ready, playing, setPlaying, source, setSource, reduced } = controller,
    copy = common[kind]
  const status = !ready
    ? t.renewables.moving
    : !source
      ? copy.inactive
      : reduced
        ? common.static
        : playing
          ? common.running
          : common.paused
  return (
    <div className="principle-controls" role="group" aria-label={common.controls}>
      <button
        className="principle-play"
        disabled={reduced || !ready}
        onClick={() => setPlaying((v) => !v)}
        aria-pressed={playing && !reduced}
      >
        {playing && !reduced ? <Pause size={15} /> : <Play size={15} />}{' '}
        {reduced ? common.static : playing ? common.pause : common.play}
      </button>
      <button
        role="switch"
        disabled={!ready}
        aria-checked={source}
        aria-label={copy.sourceLabel}
        onClick={() => setSource((v) => !v)}
      >
        {kind === 'pv' ? <Sun size={15} /> : <Wind size={15} />} {copy.sourceLabel}
        <span>{source ? common.on : common.off}</span>
      </button>
      <span className="generation-status" aria-live="polite">
        {status}
      </span>
    </div>
  )
}

export function GenerationOverlay({
  controller,
  onRotorPick,
}: {
  controller: Controller
  onRotorPick?: () => void
}) {
  const { t } = useI18n(),
    common = t.renewables.principle
  const { kind, ready, overview, source, reduced, figure, ref } = controller
  const marker = useId(),
    circuit = pathOf(cellCircuit)
  return (
    <g
      ref={figure}
      className="generation-overlay"
      data-source={source}
      data-ready={ready}
      data-overview={overview}
      data-reduced={reduced}
      style={{ opacity: ready ? 1 : 0, pointerEvents: 'none' }}
    >
      {kind === 'wind' && overview ? (
        <>
          <g className="wind-field full-wind-field" data-energy="wind">
            {fullWindStreams.map((stream, i) => (
              <g key={i}>
                <path d={stream.d} className="wind-guide" />
                <path ref={ref(`wind-${i}`)} d={stream.d} className="wind-streak" />
              </g>
            ))}
          </g>
          <g transform={rotorPlane(-15)}>
            <g
              ref={ref('rotor')}
              data-moving="rotor"
              style={{ pointerEvents: ready ? 'auto' : 'none', cursor: 'pointer' }}
              onClick={(event) => {
                event.stopPropagation()
                onRotorPick?.()
              }}
            >
              {[0, 120, 240].map((deg) => (
                <g key={deg} transform={`rotate(${deg + 90})`}>
                  <path
                    d="M14 -3 L40 -14 L95 -16 L310 -1 L315 1 L75 10 L14 3 Z"
                    className="principle-blade full-blade"
                  />
                  <path d="M14 0 L75 4 L315 1" className="blade-ridge" />
                </g>
              ))}
            </g>
          </g>
          {geometry.wind.parts
            .filter((part) => part.id === 'hub')
            .map((part) => (
              <Solid key={part.id} id={part.id} paths={part.paths} />
            ))}
        </>
      ) : kind === 'pv' ? (
        <>
          {' '}
          <defs>
            <marker
              id={marker}
              markerUnits="userSpaceOnUse"
              markerWidth="7"
              markerHeight="7"
              refX="5"
              refY="3.5"
              orient="auto"
            >
              <path d="M1 1 L5 3.5 L1 6" className="principle-arrow" />
            </marker>
          </defs>
          <g className="sunlight-field" data-energy="sunlight">
            <g transform={`translate(${sunlightOrigin.join(' ')})`} className="sun-emitter">
              <circle r="10" />
              {sunlightRays.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </g>
            <path
              d={coating.paths.top}
              transform={`translate(${coating.offset.join(' ')})`}
              className="sunlit-surface"
            />
            {cellLanes.map((lane, i) => (
              <g key={i}>
                <defs>
                  <linearGradient
                    id={`${marker}-beam-${i}`}
                    gradientUnits="userSpaceOnUse"
                    x1={lane.photon[0][0]}
                    y1={lane.photon[0][1]}
                    x2={lane.photon[1][0]}
                    y2={lane.photon[1][1]}
                  >
                    <stop offset="0" stopColor="var(--photon)" stopOpacity="0" />
                    <stop offset=".2" stopColor="var(--photon)" stopOpacity=".34" />
                    <stop offset=".8" stopColor="var(--photon)" stopOpacity=".24" />
                    <stop offset="1" stopColor="var(--photon)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={beamPolygon(lane.photon[0], lane.photon[1])}
                  fill={`url(#${marker}-beam-${i})`}
                />
              </g>
            ))}
          </g>
          <path d={circuit} className="principle-circuit" />
          {electrons.map((i) => (
            <g
              key={i}
              ref={ref(`external-${i}`)}
              className="external-electron"
              style={{ opacity: 0 }}
            >
              <Charge symbol="e−" kind="electron" />
            </g>
          ))}
          <rect
            x={cellLoad[0] - 18}
            y={cellLoad[1] - 9}
            width="36"
            height="18"
            rx="2"
            className="inline-load"
          />
          <text
            x={cellLoad[0]}
            y={cellLoad[1] + 3}
            className="principle-load-label"
            textAnchor="middle"
          >
            {common.pv.load}
          </text>
          {[cellCircuit[0], cellCircuit[cellCircuit.length - 1]].map((p, i) => (
            <g key={i}>
              <circle cx={p[0]} cy={p[1]} r="4" className="principle-terminal" />
              <text
                x={p[0] + (i ? -8 : 8)}
                y={p[1] - 13}
                textAnchor={i ? 'end' : 'start'}
                className="principle-label"
              >
                {i ? common.pv.pSide : common.pv.nSide}
              </text>
            </g>
          ))}
          {cellLanes.map((lane, i) => (
            <g key={i}>
              <path d={pathOf(lane.photon)} className="photon-guide" />
              <g ref={ref(`photon-${i}`)} data-particle="photon" style={{ opacity: 0 }}>
                <circle r="8" className="photon-dot" />
                <path className="photon-wave" d="M-5 -11 Q-12 -7 -5 -3 Q2 1 -5 5" />
                <path className="photon-head" d="M-9 3 L-4 8 L-2 1" />
              </g>
              <g
                ref={ref(`absorb-${i}`)}
                className="absorption-flash"
                data-energy="absorption"
                style={{ opacity: 0 }}
              >
                <circle r="19" />
                <circle r="9" />
              </g>
              <g ref={ref(`electron-${i}`)} data-particle="electron" style={{ opacity: 0 }}>
                <Charge symbol="e−" kind="electron" />
              </g>
              <g ref={ref(`hole-${i}`)} data-particle="hole" style={{ opacity: 0 }}>
                <Charge symbol="h+" kind="hole" />
              </g>
              {reduced && source && (
                <>
                  <path
                    d={pathOf(lane.electron)}
                    className="carrier-direction"
                    markerEnd={`url(#${marker})`}
                  />
                  <path
                    d={pathOf(lane.hole)}
                    className="carrier-direction"
                    markerEnd={`url(#${marker})`}
                  />
                </>
              )}
            </g>
          ))}
          {[0.16, 0.68].map((f) => (
            <path
              key={f}
              d={pathOf([circuitAt(f), circuitAt(f + 0.025)])}
              className="carrier-direction"
              markerEnd={`url(#${marker})`}
            />
          ))}
        </>
      ) : (
        <>
          {' '}
          <g className="wind-field" data-energy="wind">
            {windStreams.map((stream, i) => (
              <g key={i}>
                <path d={stream.d} className="wind-guide" />
                <path ref={ref(`wind-${i}`)} d={stream.d} className="wind-streak" />
                {reduced && (
                  <path d={pathOf(stream.points.slice(19, 22))} className="wind-direction" />
                )}
              </g>
            ))}
          </g>
          {shafts.map((_, i) =>
            cells.slice(0, 3).map((j) => (
              <g
                key={`${i}-${j}`}
                transform={offsetTransform(i < 3 ? 'main-shaft-0' : 'high-speed-91')}
              >
                <path ref={ref(`shaft-${i}-${j}`)} className="shaft-mark" />
              </g>
            )),
          )}
          <g transform={offsetTransform('generator')}>
            <g transform={rotorPlane(114.8)} data-fixed="stator">
              <circle r="15" className="stator-body" />
              <circle r="11" className="stator-gap" />
              {Array.from({ length: 8 }, (_, i) => (
                <g key={i} transform={`rotate(${i * 45})`}>
                  <rect x="-1.5" y="-14.6" width="3" height="3" rx=".6" className="stator-coil" />
                </g>
              ))}
              <g ref={ref('generator')} data-moving="generator">
                <path d="M0 -9 A9 9 0 0 1 0 9 Z" className="magnet-n" />
                <path d="M0 9 A9 9 0 0 1 0 -9 Z" className="magnet-s" />
                <text x="4.5" y="1.4" className="pole-letter" textAnchor="middle">
                  N
                </text>
                <text x="-4.5" y="1.4" className="pole-letter" textAnchor="middle">
                  S
                </text>
                <circle r="2.5" className="rotor-shaft" />
              </g>
            </g>
          </g>
          <g transform={offsetTransform('hub')}>
            <g transform={rotorPlane(-15)}>
              <g ref={ref('rotor')} data-moving="rotor">
                {[0, 120, 240].map((deg) => (
                  <g key={deg} transform={`rotate(${deg + 90})`}>
                    <path
                      d="M14 -3 L23 -8 L37 -8 L58 -1 L60 1 L31 5 L14 3 Z"
                      className="principle-blade"
                    />
                  </g>
                ))}
              </g>
            </g>
            {geometry.wind.parts
              .filter((part) => part.id === 'hub')
              .map((part) => (
                <Solid key={part.id} id={part.id} paths={part.paths} />
              ))}
          </g>
        </>
      )}
    </g>
  )
}

export function GenerationLegend({ controller }: { controller: Controller }) {
  const { t } = useI18n(),
    common = t.renewables.principle,
    { kind, overview, ref } = controller,
    copy = common[kind]
  return (
    <>
      <div className="principle-legend">
        {kind === 'pv' ? (
          <>
            <span className="legend-photon">hν · {common.pv.photons}</span>
            <span className="legend-electron">e− · {common.pv.electrons}</span>
            <span className="legend-hole">h+ · {common.pv.holes}</span>
            <span>{common.pv.circuit} →</span>
          </>
        ) : overview ? (
          <>
            <span className="legend-electron">→ {common.wind.airflow}</span>
            <span>↻ {common.wind.overviewLegend}</span>
          </>
        ) : (
          <>
            <span className="legend-electron">→ {common.wind.airflow}</span>
            <span>↻ {common.wind.rotor}</span>
            <span>↻ {common.wind.generator}</span>
            <span>{common.wind.stator}</span>
            <span className="ac-readout">
              <svg viewBox="0 0 160 36" aria-hidden="true">
                <path ref={ref('ac')} className="ac-trace" />
              </svg>
              {common.wind.output}
            </span>
          </>
        )}
      </div>
      <p className="principle-detail">{overview ? common.wind.overviewDetail : copy.detail}</p>
    </>
  )
}
export function GenerationExplanation({ kind }: { kind: Kind }) {
  const { t } = useI18n(),
    common = t.renewables.principle,
    copy = common[kind]
  return (
    <section className="inline-generation-explanation">
      <h3>{common.title}</h3>
      {copy.steps.map((step) => (
        <section key={step.title}>
          <h4>{step.title}</h4>
          <p>{step.body}</p>
        </section>
      ))}
      <p className="principle-note">{common.note}</p>
    </section>
  )
}
