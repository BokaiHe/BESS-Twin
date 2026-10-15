import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Home, Minus, Plus, RotateCw, TriangleAlert, ArrowUpRight } from 'lucide-react'
import { timeLabel } from './domain/config'
import { BESS_IDS, NODE_BY_ID, connectedEdgeIds } from './domain/topology'
import type { ScenarioId, SimulationDay, Snapshot, TwinDataSource } from './domain/types'
import { simulationSource } from './data/simulationSource'
import { snapshotAt } from './simulation/engine'
import { useI18n } from './i18n'
import { BESS_CENTER, FAULT_NODE, type SceneLabel, type Selection } from './components/scene/shared'
import { TopBar } from './ui/TopBar'
import { KpiStrip } from './ui/KpiStrip'
import { DetailCard } from './ui/DetailCard'
import { DeviceList } from './ui/DeviceList'
import { Timeline } from './ui/Timeline'
import { Modal } from './ui/Modal'
import { SavingsPanel } from './ui/SavingsPanel'
import { GuidedTour } from './ui/GuidedTour'
import { ExplorerHub } from './ui/ExplorerHub'
import { TONE, clusterMode, modeText, modeTone, mw } from './ui/format'

const ContainerExplorer = lazy(() => import('./components/cabinet/ContainerExplorer'))
const RenewableExplorer = lazy(() => import('./components/renewables/RenewableExplorer'))
const EnergyScene = lazy(() => import('./components/EnergyScene'))

class SceneBoundary extends Component<
  { children: ReactNode; fallback: string },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <div className="scene-fallback">{this.props.fallback}</div>
    ) : (
      this.props.children
    )
  }
}

type Focus = Selection | 'overview'
export default function App({ source = simulationSource }: { source?: TwinDataSource }) {
  const { t, l, lang } = useI18n()
  const [scenario, setScenario] = useState<ScenarioId>('sunny')
  const [day, setDay] = useState<SimulationDay | null>(null)
  const [baseline, setBaseline] = useState<SimulationDay | null>(null)
  const [error, setError] = useState('')
  const [minute, setMinute] = useState(720)
  const clock = useRef(720)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(30)
  const [touring, setTouring] = useState(false)
  const [selected, setSelected] = useState<Selection | null>(null)
  const [focus, setFocus] = useState<{ key: Focus; serial: number }>({ key: 'overview', serial: 0 })
  const [zoomCmd, setZoomCmd] = useState<{ dir: 1 | -1; serial: number }>({ dir: 1, serial: 0 })
  const [autoRotate, setAutoRotate] = useState(false)
  const [modal, setModal] = useState<
    'about' | 'savings' | 'alarms' | 'container' | 'pv' | 'wind' | null
  >(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  // The left column may only use the height above the timeline and its legend, so the
  // explorer hub can never slide underneath them (it scrolls internally instead).
  const overlay = useRef<HTMLDivElement>(null)
  const bottomRow = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const root = overlay.current,
      row = bottomRow.current
    if (!root || !row) return
    const update = () => {
      const legend = row.querySelector<HTMLElement>('.legend-chip')
      const legendSpace = legend && legend.offsetParent ? legend.offsetHeight + 8 : 0
      const reserve =
        root.getBoundingClientRect().bottom - row.getBoundingClientRect().top + legendSpace + 12
      root.style.setProperty('--bottom-reserve', `${Math.round(reserve)}px`)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(row)
    observer.observe(root)
    return () => observer.disconnect()
  }, [day])
  const tourReturn = useRef<{ selected: Selection | null; rotate: boolean; focus: Focus }>({
    selected: null,
    rotate: false,
    focus: 'overview',
  })

  useEffect(() => {
    // Old preview bookmarks now land on the site overview, too.
    const url = new URL(window.location.href)
    if (url.searchParams.get('view') === 'container') {
      url.searchParams.delete('view')
      window.history.replaceState(
        window.history.state,
        '',
        `${url.pathname}${url.search}${url.hash}`,
      )
    }
  }, [])

  useEffect(() => {
    document.title =
      lang === 'zh' ? 'BESS Twin · 源网荷储数字孪生' : 'BESS Twin · Energy Digital Twin'
  }, [lang])
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    let cancelled = false
    setError('')
    Promise.all([source.loadDay(scenario), source.loadDay('sunny')])
      .then(([result, normal]) => {
        if (!cancelled) {
          setDay(result)
          setBaseline(normal)
        }
      })
      .catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [scenario, source])

  // Playback: a fractional clock advances every frame (smooth sun and camera), while the
  // data minute only changes when the integer minute does. Seeking never integrates anything.
  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    let raf = 0
    const tick = (now: number) => {
      // A frame timestamp can precede the performance.now() taken when playback started,
      // so never step backwards, and keep the clock inside the simulated day.
      const elapsed = Math.max(0, now - last) / 1000
      clock.current = Math.min(1439, Math.max(0, clock.current + elapsed * speed))
      last = Math.max(last, now)
      const m = Math.floor(clock.current)
      setMinute((prev) => (prev === m ? prev : m))
      if (clock.current >= 1439) {
        setPlaying(false)
        setTouring(false)
      } else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed])
  useEffect(() => {
    if (!playing) clock.current = minute
  }, [minute, playing])

  const flyTo = useCallback((key: Focus) => setFocus((f) => ({ key, serial: f.serial + 1 })), [])
  const select = useCallback(
    (sel: Selection) => {
      setSelected(sel)
      flyTo(sel)
    },
    [flyTo],
  )
  const seek = useCallback((m: number) => {
    setPlaying(false)
    setTouring(false)
    setMinute(m)
  }, [])

  const focusTour = useCallback(
    (key: Focus) => {
      if (key !== 'overview') setSelected(key)
      flyTo(key)
    },
    [flyTo],
  )

  const closeTour = useCallback(() => {
    setTouring(false)
    setSelected(tourReturn.current.selected)
    setAutoRotate(tourReturn.current.rotate)
    flyTo(tourReturn.current.focus)
  }, [flyTo])

  const toggleTour = () => {
    if (touring) {
      closeTour()
      return
    }
    tourReturn.current = { selected, rotate: autoRotate, focus: focus.key }
    setPlaying(false)
    setAutoRotate(false)
    setModal(null)
    setTouring(true)
  }

  const changeScenario = (id: ScenarioId) => {
    setTouring(false)
    setPlaying(false)
    setScenario(id)
    if (id === 'fault') {
      setMinute(1050)
      select(FAULT_NODE)
    }
  }

  const snapshot: Snapshot | null = day
    ? snapshotAt(day, Math.min(1439, Math.max(0, Math.floor(minute))))
    : null

  const highlighted = useMemo(() => {
    if (!selected) return []
    if (selected === 'bess-cluster') return BESS_IDS.map((id) => `bus-${id}`)
    return connectedEdgeIds(selected)
  }, [selected])

  const labels: SceneLabel[] = useMemo(() => {
    if (!snapshot) return []
    const m = snapshot.metrics
    const cm = clusterMode(snapshot)
    const pos = (id: keyof typeof NODE_BY_ID, y: number): [number, number, number] => {
      const p = NODE_BY_ID[id].position
      return [p[0], y, p[2]]
    }
    const list: SceneLabel[] = [
      {
        key: 'grid',
        anchor: pos('grid', 6.9),
        name: l(NODE_BY_ID.grid.name),
        value:
          m.gridImportMW > 0.01
            ? `↓ ${mw(m.gridImportMW)} MW`
            : m.gridExportMW > 0.01
              ? `↑ ${mw(m.gridExportMW)} MW`
              : '—',
        tone: TONE.grid,
        selected: selected === 'grid',
        onClick: () => select('grid'),
      },
      {
        key: 'pv',
        anchor: pos('pv', 2.4),
        name: l(NODE_BY_ID.pv.name),
        value: `${mw(m.pvMW)} MW`,
        tone: TONE.renewable,
        selected: selected === 'pv',
        onClick: () => select('pv'),
      },
      {
        key: 'wind',
        anchor: pos('wind-2', 9.8),
        name: t.labels.windFarm,
        value: `${mw(m.windMW)} MW`,
        tone: TONE.renewable,
        selected: selected?.startsWith('wind') ?? false,
        onClick: () => select('wind-2'),
      },
      {
        key: 'bess',
        anchor: BESS_CENTER,
        name: t.labels.bessPlant,
        value: `${modeText(t, cm)}${cm !== 'idle' ? ` ${mw(m.batteryChargeMW + m.batteryDischargeMW)} MW` : ''} · ${m.socPct.toFixed(0)}%`,
        tone: modeTone(cm),
        selected: selected === 'bess-cluster',
        alert: snapshot.alarms.length > 0,
        onClick: () => select('bess-cluster'),
      },
      {
        key: 'factory',
        anchor: pos('factory', 6.4),
        name: l(NODE_BY_ID.factory.name),
        value: `${mw(snapshot.nodes.factory.injectionMW)} MW`,
        tone: TONE.grid,
        selected: selected === 'factory',
        onClick: () => select('factory'),
      },
      {
        key: 'residential',
        anchor: pos('residential', 4.6),
        name: l(NODE_BY_ID.residential.name),
        value: `${mw(snapshot.nodes.residential.injectionMW)} MW`,
        tone: TONE.grid,
        selected: selected === 'residential',
        onClick: () => select('residential'),
      },
    ]
    const covered = ['grid', 'pv', 'wind-2', 'bess-cluster', 'factory', 'residential']
    if (selected && !covered.includes(selected)) {
      const node = NODE_BY_ID[selected as keyof typeof NODE_BY_ID]
      const isBess = node.kind === 'bess'
      list.push({
        key: `sel-${selected}`,
        anchor: pos(node.id, node.kind === 'wind' ? 9.4 : isBess ? 2.3 : 3),
        name: l(node.name),
        value: isBess
          ? `${modeText(t, snapshot.nodes[node.id].status === 'offline' ? 'offline' : snapshot.nodes[node.id].injectionMW > 0.01 ? 'discharge' : snapshot.nodes[node.id].injectionMW < -0.01 ? 'charge' : 'idle')} · ${snapshot.nodes[node.id].socPct!.toFixed(0)}%`
          : node.kind === 'wind'
            ? `${mw(snapshot.nodes[node.id].injectionMW)} MW`
            : node.voltage,
        tone: snapshot.alarms.some((a) => a.nodeId === node.id) ? TONE.alarm : TONE.brand,
        selected: true,
        alert: snapshot.alarms.some((a) => a.nodeId === node.id),
        onClick: () => select(node.id),
      })
    }
    return list
  }, [snapshot, selected, l, t, select])

  if (error)
    return (
      <div className="splash">
        <strong>{t.loadFailed}</strong>
        <p>{error}</p>
        <button className="pill-btn" onClick={() => window.location.reload()}>
          {t.reload}
        </button>
      </div>
    )
  if (!day || !baseline || !snapshot)
    return (
      <div className="splash">
        <div className="spinner" />
        <p>{t.loading}</p>
      </div>
    )

  const alarm = snapshot.alarms[0]

  return (
    <div className="app">
      <div className="stage">
        <SceneBoundary fallback={t.noWebgl}>
          <Suspense fallback={<div className="scene-fallback">{t.sceneLoading}</div>}>
            <EnergyScene
              paused={modal === 'container' || modal === 'pv' || modal === 'wind'}
              snapshot={snapshot}
              clock={clock}
              scenario={scenario}
              selected={selected}
              highlighted={highlighted}
              onSelect={select}
              focus={focus}
              zoomCmd={zoomCmd}
              autoRotate={autoRotate}
              reducedMotion={reducedMotion}
              labels={labels}
            />
          </Suspense>
        </SceneBoundary>
      </div>

      <div className="overlay" ref={overlay}>
        <TopBar
          scenario={scenario}
          setScenario={changeScenario}
          snapshot={snapshot}
          touring={touring}
          toggleTour={toggleTour}
          onAlarms={() => setModal('alarms')}
          onAbout={() => setModal('about')}
        />

        <div className="left-col">
          <KpiStrip snapshot={snapshot} onSavings={() => setModal('savings')} />
          {alarm && (
            <button
              className={`card alarm-toast ${alarm.severity}`}
              onClick={() => select(alarm.nodeId)}
            >
              <TriangleAlert size={18} />
              <span>
                <strong>{t.alarms[alarm.code].title}</strong>
                <small>
                  {timeLabel(alarm.startedAtMinute)} · {t.alarms.locate}
                </small>
              </span>
              <ArrowUpRight size={15} />
            </button>
          )}
          <ExplorerHub
            onOpen={(kind) => {
              setPlaying(false)
              setTouring(false)
              setModal(kind)
            }}
          />
        </div>

        <div className="right-col">
          <div className="card cam-tools" role="toolbar">
            <button
              className="icon-btn"
              aria-label={t.camera.zoomIn}
              title={t.camera.zoomIn}
              onClick={() => setZoomCmd((z) => ({ dir: 1, serial: z.serial + 1 }))}
            >
              <Plus size={16} />
            </button>
            <button
              className="icon-btn"
              aria-label={t.camera.zoomOut}
              title={t.camera.zoomOut}
              onClick={() => setZoomCmd((z) => ({ dir: -1, serial: z.serial + 1 }))}
            >
              <Minus size={16} />
            </button>
            <button
              className={`icon-btn${autoRotate ? ' is-on' : ''}`}
              aria-label={t.camera.rotate}
              aria-pressed={autoRotate}
              title={t.camera.rotate}
              onClick={() => setAutoRotate(!autoRotate)}
            >
              <RotateCw size={15} />
            </button>
            <button
              className="icon-btn"
              aria-label={t.camera.reset}
              title={t.camera.reset}
              onClick={() => flyTo('overview')}
            >
              <Home size={15} />
            </button>
          </div>
          {selected && (
            <DetailCard
              selection={selected}
              snapshot={snapshot}
              onSelect={select}
              onInspect={() => {
                setPlaying(false)
                setTouring(false)
                setModal(
                  selected === 'pv' ? 'pv' : selected.startsWith('wind-') ? 'wind' : 'container',
                )
              }}
              onClose={() => {
                setSelected(null)
                flyTo('overview')
              }}
            />
          )}
        </div>

        <div className="bottom-row" ref={bottomRow}>
          <div className="timeline-slot">
            <div className="legend-chip">
              {(
                [
                  [TONE.renewable, t.legend.renewable],
                  [TONE.grid, t.legend.grid],
                  [TONE.charge, t.legend.charge],
                  [TONE.discharge, t.legend.discharge],
                ] as const
              ).map(([c, label]) => (
                <span key={label}>
                  <i style={{ background: c }} />
                  {label}
                </span>
              ))}
              <em>{t.modelNote}</em>
            </div>
            <Timeline
              day={day}
              baseline={baseline}
              minute={minute}
              playing={playing}
              setPlaying={(v) => {
                if (v && minute >= 1439) {
                  clock.current = 0
                  setMinute(0)
                }
                if (!v) setTouring(false)
                setPlaying(v)
              }}
              onSeek={seek}
              speed={speed}
              setSpeed={setSpeed}
              story={{
                key: `${snapshot.strategy.code}-${lang}`,
                title: t.strategy[snapshot.strategy.code],
                text: t.strategyReason[snapshot.strategy.code](
                  snapshot.strategy.peakLevelMW.toFixed(1),
                ),
                tone: modeTone(clusterMode(snapshot)),
              }}
            />
          </div>
          <DeviceList snapshot={snapshot} selected={selected} onSelect={select} />
        </div>
      </div>

      {touring && <GuidedTour onClose={closeTour} onFocus={focusTour} />}

      {modal === 'container' && (
        <Modal title={t.cabinet.title} className="container-modal" onClose={() => setModal(null)}>
          <Suspense fallback={<p>{t.cabinet.loading}</p>}>
            <ContainerExplorer />
          </Suspense>
        </Modal>
      )}
      {(modal === 'pv' || modal === 'wind') && (
        <Modal
          title={t.renewables[modal].title}
          className="renewable-modal"
          onClose={() => setModal(null)}
        >
          <Suspense fallback={<p>{t.renewables.loading}</p>}>
            <RenewableExplorer key={modal} kind={modal} />
          </Suspense>
        </Modal>
      )}
      {modal === 'about' && (
        <Modal title={t.about} onClose={() => setModal(null)}>
          {t.aboutBody.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </Modal>
      )}
      {modal === 'savings' && (
        <Modal title={t.savings.explainTitle} onClose={() => setModal(null)} wide>
          <SavingsPanel day={day} minute={minute} />
        </Modal>
      )}
      {modal === 'alarms' && (
        <Modal
          title={`${t.alarms.title} · ${snapshot.alarms.length}`}
          onClose={() => setModal(null)}
        >
          {snapshot.alarms.length === 0 && <p className="muted">{t.alarms.none}</p>}
          {snapshot.alarms.map((a) => (
            <button
              key={a.id}
              className={`alarm-item ${a.severity}`}
              onClick={() => {
                select(a.nodeId)
                setModal(null)
              }}
            >
              <TriangleAlert size={18} />
              <span>
                <strong>{t.alarms[a.code].title}</strong>
                <small>
                  {timeLabel(a.startedAtMinute)} · {t.alarms[a.code].impact}
                </small>
              </span>
              <ArrowUpRight size={15} />
            </button>
          ))}
        </Modal>
      )}
    </div>
  )
}
