import type { Snapshot, NodeId } from '../../domain/types'
import { explorerState } from '../../learning/explorerState'
import { ExplorerSnapshot } from '../../ui/learning/ExplorerSnapshot'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUpRight, Moon, RotateCcw, Sun } from 'lucide-react'
import { useI18n } from '../../i18n'
import geometry from './geometry.json'
import {
  useGeneration,
  GenerationControls,
  GenerationOverlay,
  GenerationLegend,
  GenerationExplanation,
} from './GenerationPrinciple'
import { cellAnimationCamera, windAnimationCamera, fullWindCamera } from './generationModel'
import '../cabinet/iso.css'
import './renewables.css'

type Kind = 'pv' | 'wind'
type SceneName = Kind | 'pvCell'
const clamp = (v: number) => Math.max(0, Math.min(1, v))
const ease = (v: number) => v * v * (3 - 2 * v)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function Figure({
  kind,
  stage,
  selected,
  onPick,
  outputRatio,
}: {
  outputRatio?: number
  kind: Kind
  stage: number
  selected: string
  onPick: (group: string) => void
}) {
  const { t } = useI18n()
  const copy = t.renewables[kind]
  const svg = useRef<SVGSVGElement>(null)
  const main = useRef<SVGGElement>(null)
  const detail = useRef<SVGGElement>(null)
  const progress = useRef(0)
  const nodes = useRef(new Map<string, SVGGElement>())
  const [busy, setBusy] = useState(false)
  const [settledStage, setSettledStage] = useState(0)
  const overview = kind === 'wind' && stage === 0
  const generation = useGeneration(
    kind,
    (stage === 2 || overview) && !busy && settledStage === stage,
    kind === 'wind' && (stage === 0 || settledStage === 0),
    outputRatio,
  )
  const scenes: SceneName[] = kind === 'pv' ? ['pv', 'pvCell'] : ['wind']

  useEffect(() => {
    const element = svg.current!
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0,
      visible = true,
      start = 0,
      from = progress.current,
      duration = 900
    const paint = (value: number) => {
      progress.current = value
      element.dataset.progress = value.toFixed(4)
      const open = clamp(value),
        split = clamp(value - 1)
      for (const name of (kind === 'pv' ? ['pv', 'pvCell'] : ['wind']) as SceneName[]) {
        for (const part of geometry[name].parts) {
          const node = nodes.current.get(`${name}/${part.id}`)
          if (!node) continue
          const share =
            name === 'pvCell'
              ? ease(clamp((split - 0.15) / 0.85))
              : part.ride === 'split'
                ? split
                : open
          node.setAttribute(
            'transform',
            `translate(${part.offset[0] * share} ${part.offset[1] * share})`,
          )
          let opacity = 1
          if (kind === 'wind') {
            if (['housing', 'sensors'].includes(part.group)) opacity = 1 - ease(open)
            if (['tower', 'rotor'].includes(part.group)) opacity = 1 - ease(open)
          }
          node.style.opacity = `${opacity}`
          node.style.pointerEvents = opacity < 0.05 ? 'none' : ''
        }
      }
      const cameras =
        kind === 'wind'
          ? [fullWindCamera, ...geometry.wind.cameras.slice(1)]
          : geometry[kind].cameras
      let camera = cameras[0].map((v, i) => lerp(v, cameras[1][i], open))
      if (kind === 'wind') camera = camera.map((v, i) => lerp(v, windAnimationCamera[i], split))
      if (kind === 'pv') {
        const fade = ease(clamp(split / 0.45))
        main.current!.style.opacity = `${1 - fade}`
        main.current!.style.pointerEvents = split > 0 ? 'none' : ''
        detail.current!.style.opacity = `${ease(clamp((split - 0.05) / 0.4))}`
        detail.current!.style.pointerEvents = split > 0.45 ? '' : 'none'
        // Bring the representative cell into focus, then physically separate its layers.
        main.current!.querySelector('svg')!.setAttribute('viewBox', camera.join(' '))
        const cellShare = ease(clamp((split - 0.15) / 0.85))
        const cellCamera = geometry.pvCell.cameras[0].map((v, i) =>
          lerp(v, cellAnimationCamera[i], cellShare),
        )
        detail.current!.querySelector('svg')!.setAttribute('viewBox', cellCamera.join(' '))
      } else element.setAttribute('viewBox', camera.join(' '))
    }
    const tick = (now: number) => {
      frame = 0
      if (document.hidden || !visible) return
      if (!start) start = now
      const fraction = reduced.matches ? 1 : clamp((now - start) / duration)
      paint(lerp(from, stage, ease(fraction)))
      if (fraction < 1) frame = requestAnimationFrame(tick)
      else {
        setBusy(false)
        setSettledStage(stage)
      }
    }
    const resume = () => {
      cancelAnimationFrame(frame)
      from = progress.current
      start = 0
      duration = 900 * Math.max(1, Math.abs(stage - from))
      if (Math.abs(from - stage) < 0.0001) {
        paint(stage)
        setBusy(false)
        setSettledStage(stage)
        return
      }
      if (reduced.matches) {
        paint(stage)
        setBusy(false)
        setSettledStage(stage)
        return
      }
      if (!document.hidden && visible) frame = requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting
      resume()
    })
    observer.observe(element)
    document.addEventListener('visibilitychange', resume)
    reduced.addEventListener('change', resume)
    setBusy(Math.abs(progress.current - stage) > 0.0001)
    paint(progress.current)
    resume()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', resume)
      reduced.removeEventListener('change', resume)
    }
  }, [kind, stage])

  const solids = (name: SceneName) =>
    geometry[name].parts
      .filter(
        (part) =>
          name !== 'wind' ||
          (!part.id.startsWith('blade-') && !part.id.startsWith('pitch-') && part.id !== 'hub'),
      )
      .map((part) => (
        <g
          key={part.id}
          ref={(node) => {
            const key = `${name}/${part.id}`
            if (node) nodes.current.set(key, node)
            else nodes.current.delete(key)
          }}
          className="iso-solid renewable-solid"
          data-part={part.id}
          data-group={part.group}
          data-lit={selected === part.group || undefined}
          data-material={
            name === 'pv'
              ? part.group
              : name === 'pvCell' && ['silicon', 'junction', 'coating'].includes(part.group)
                ? 'silicon'
                : undefined
          }
          onClick={(event) => {
            event.stopPropagation()
            onPick(part.group)
          }}
        >
          <title>
            {
              copy.parts.find(
                (item) =>
                  item.id === part.group &&
                  (kind !== 'pv' || (name === 'pvCell' ? item.level === 2 : item.level !== 2)),
              )?.name
            }
          </title>
          <path className="iso-fill" d={part.paths.fill} fillRule="evenodd" />
          {part.paths.shades.map(
            (path, index) =>
              path && <path key={index} className="iso-shade" data-shade={index} d={path} />,
          )}
          <path className="iso-top" d={part.paths.top} />
          <path className="iso-line iso-edge" data-tone="mid" d={part.paths.outline} />
          <path className="iso-line" data-tone="lo" d={part.paths.crease} />
        </g>
      ))
  return (
    <>
      <figure
        className="renewable-plate inline-generation-plate"
        data-stage={stage}
        aria-busy={busy}
      >
        <div className="renewable-caption">
          <span>{kind === 'pv' ? 'FIG. 02' : 'FIG. 03'}</span>
          <span>{copy.stages[stage]}</span>
        </div>
        <svg
          ref={svg}
          className="iso-svg renewable-svg"
          viewBox={kind === 'wind' ? fullWindCamera.join(' ') : '0 0 900 560'}
          role="img"
          aria-label={`${copy.title}: ${copy.stages[stage]}`}
        >
          <title>{copy.title}</title>
          {kind === 'pv' ? (
            <>
              <g ref={main}>
                <svg width="900" height="560" viewBox={geometry.pv.cameras[0].join(' ')}>
                  {solids(scenes[0])}
                </svg>
              </g>
              <g ref={detail} style={{ opacity: 0, pointerEvents: 'none' }}>
                <svg width="900" height="560" viewBox={geometry.pvCell.cameras[1].join(' ')}>
                  {solids('pvCell')}
                  <GenerationOverlay controller={generation} />
                </svg>
              </g>
            </>
          ) : (
            <>
              {solids('wind')}
              <GenerationOverlay controller={generation} onRotorPick={() => onPick('rotor')} />
            </>
          )}
        </svg>
        <figcaption>
          <span>{copy.hints[stage]}</span>
          <span aria-live="polite">{busy ? t.renewables.moving : copy.stages[stage]}</span>
        </figcaption>
      </figure>
      {(stage === 2 || overview) && (
        <div className="inline-generation">
          <GenerationControls controller={generation} />
          <GenerationLegend controller={generation} />
        </div>
      )}
    </>
  )
}

export default function RenewableExplorer({
  kind,
  context,
}: {
  kind: Kind
  context?: { snapshot: Snapshot; nodeId: NodeId }
}) {
  const linked = kind === 'wind' && context ? explorerState(context.snapshot, context.nodeId) : null
  const { t } = useI18n()
  const common = t.renewables,
    copy = common[kind]
  const [stage, setStage] = useState(0)
  const [selected, setSelected] = useState(copy.defaults[0])
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const changeStage = (value: number) => {
    setStage(value)
    setSelected(copy.defaults[value])
  }
  const visibleParts = copy.parts.filter(
    (part) => kind !== 'pv' || (stage === 2 ? part.level === 2 : part.level !== 2),
  )
  const part = visibleParts.find((part) => part.id === selected) ?? visibleParts[0]
  const pick = (id: string, direct = false) => {
    if (!visibleParts.some((part) => part.id === id)) return
    if (stage === 0 && direct) {
      changeStage(1)
      return
    }
    if (
      direct &&
      stage === 1 &&
      ((kind === 'pv' && ['cells', 'ribbons'].includes(id)) ||
        (kind === 'wind' && ['shaft', 'gearbox', 'coupling'].includes(id)))
    ) {
      changeStage(2)
      return
    }
    if (kind === 'wind' && ['housing', 'tower', 'rotor', 'sensors'].includes(id)) setStage(0)
    else if (stage === 0 && visibleParts.find((part) => part.id === id)!.level > 0) setStage(1)
    setSelected(id)
  }
  return (
    <section className="iso renewable-explorer" data-theme={theme} data-kind={kind}>
      <header className="renewable-intro">
        <div>
          <p className="renewable-kicker">{common.context}</p>
          <p>{copy.subtitle}</p>
        </div>
        <button
          className="renewable-icon"
          aria-label={common.theme}
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </header>
      {linked && <ExplorerSnapshot state={linked} />}
      <div className="renewable-toolbar">
        <div className="renewable-stages" role="group" aria-label={common.levels}>
          {copy.stages.map((label, index) => (
            <button key={label} aria-pressed={stage === index} onClick={() => changeStage(index)}>
              <span>0{index + 1}</span>
              {label}
            </button>
          ))}
        </div>
        <button className="renewable-reset" onClick={() => changeStage(0)} disabled={stage === 0}>
          <RotateCcw size={14} />
          {common.reset}
        </button>
      </div>
      <div className="renewable-structure">
        <div className="renewable-grid">
          <div className="renewable-visual">
            <Figure
              outputRatio={linked?.speedRatio}
              kind={kind}
              stage={stage}
              selected={selected}
              onPick={(id) => pick(id, true)}
            />
            <p className="renewable-select-hint">{common.selectHint}</p>
            <div className="renewable-parts" role="group" aria-label={common.components}>
              {visibleParts.map((part, index) => (
                <button
                  key={part.id}
                  aria-pressed={selected === part.id}
                  onClick={() => pick(part.id)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {part.name}
                </button>
              ))}
            </div>
          </div>
          <aside className="renewable-info" aria-live="polite">
            <div key={`${stage}-${part.id}`} className="renewable-info-copy">
              <p className="renewable-kicker">{copy.stages[stage]}</p>
              <h2>{part.name}</h2>
              <h3>{common.role}</h3>
              <p>{part.role}</p>
              <h3>{common.connection}</h3>
              <p>{part.connection}</p>
            </div>
            {stage === 2 && <GenerationExplanation kind={kind} />}
            <div className="renewable-actions">
              <button className="renewable-next" onClick={() => changeStage((stage + 1) % 3)}>
                {copy.next[stage]}
                <ArrowUpRight size={17} />
              </button>
              {stage > 0 && (
                <button className="renewable-back" onClick={() => changeStage(stage - 1)}>
                  <ArrowLeft size={14} />
                  {common.back}
                </button>
              )}
            </div>
          </aside>
        </div>
        <footer className="renewable-footer">
          <p>{copy.note}</p>
          <a href={copy.source} target="_blank" rel="noreferrer">
            {common.reference}
            <ArrowUpRight size={13} />
          </a>
        </footer>
      </div>
    </section>
  )
}
