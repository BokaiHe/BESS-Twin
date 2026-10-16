import type { NodeId, Snapshot } from '../../domain/types'
import { explorerState } from '../../learning/explorerState'
import { explorerCopy } from '../../learning/explorerCopy'
import { ExplorerSnapshot } from '../../ui/learning/ExplorerSnapshot'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUpRight, Box, Layers3, Moon, Sun, Play, Pause } from 'lucide-react'
import { useI18n } from '../../i18n'
import { CONFIG } from '../../domain/config'
import { ContainerAssembly } from './ContainerAssembly'
import { CellCutaway, CELL_MATERIALS, type CellMaterial } from './CellCutaway'
import type { CellFlowMode } from './CellTransport'
import {
  CELL_IDS,
  MODULE_LABELS,
  cellNumber,
  detailForPiece,
  type ModuleDetail,
} from './moduleDetails'
import { useSceneTransition } from './useSceneTransition'
import './iso.css'
import './container.css'

type Part =
  'enclosure' | 'battery' | 'bms' | 'protection' | 'pcs' | 'cooling' | 'safety' | 'auxiliary'
type View = 'enclosure' | 'systems' | 'module' | 'cells' | 'cell'
const PARTS: Part[] = [
  'enclosure',
  'battery',
  'bms',
  'protection',
  'pcs',
  'cooling',
  'safety',
  'auxiliary',
]
const MODULE_PARTS: Part[] = ['battery', 'bms', 'protection', 'cooling']
const REFERENCE =
  'https://www.sungrowpower.com/ca/en/products/utility-energy-storage-system/powertitan2'

export default function ContainerExplorer({
  context,
}: {
  context?: { snapshot: Snapshot; nodeId: NodeId }
}) {
  const linked = context ? explorerState(context.snapshot, context.nodeId) : null
  const snapshotMode: CellFlowMode = linked
    ? linked.mode === 'charge' || linked.mode === 'discharge'
      ? linked.mode
      : 'idle'
    : 'discharge'
  const [manual, setManual] = useState(false)
  const { t, lang } = useI18n()
  const c = t.cabinet
  const [view, setView] = useState<View>('enclosure')
  const [flowMode, setFlowMode] = useState<CellFlowMode>(snapshotMode)
  const [flowPlaying, setFlowPlaying] = useState(snapshotMode !== 'idle')
  const [cameraCommand, setCameraCommand] = useState<{ id: number; kind: 'reset' | 'in' | 'out' }>({
    id: 0,
    kind: 'reset',
  })
  const [cellPart, setCellPart] = useState<CellMaterial>('positive')
  const [cellOpen, setCellOpen] = useState(true)
  const [cellMoving, setCellMoving] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)
  const [rack, setRack] = useState(0)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState(0)
  const [selected, setSelected] = useState<Part>('enclosure')
  const [hovered, setHovered] = useState<Part | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [tour, setTour] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [visible, setVisible] = useState(true)
  const root = useRef<HTMLDivElement>(null)
  const transition = useSceneTransition(view, reduced)
  const infoPanel = useRef<HTMLElement>(null)
  const options = view === 'module' || view === 'cells' ? MODULE_PARTS : PARTS
  const target = view === 'cells' || view === 'cell' ? 2 : view === 'module' ? 1 : 0
  const active = hovered ?? selected
  const annotated = view === 'cells' && stage === 2 && !busy
  const selectedCell = detail && CELL_IDS.includes(detail) ? detail : null
  const info =
    view === 'cell'
      ? c.internalParts[cellPart]
      : detail && annotated
        ? selectedCell
          ? { ...c.cell, name: `${c.cell.name} ${cellNumber(selectedCell)}` }
          : c.moduleDetails[detail as ModuleDetail]
        : selected === 'battery' && view === 'cells'
          ? c.moduleBattery
          : selected === 'battery' && view === 'module'
            ? c.extractedBattery
            : c.parts[selected]

  useEffect(() => {
    if (reduced) return
    const animation = infoPanel.current?.animate(
      [
        { opacity: 0.35, transform: 'translateY(5px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 280, easing: 'ease-out' },
    )
    return () => animation?.cancel()
  }, [info.name, reduced])

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      setReduced(media.matches)
      if (media.matches) setTour(false)
    }
    update()
    media.addEventListener('change', update)
    const node = root.current
    const observer = new IntersectionObserver((entries) =>
      setVisible(entries[entries.length - 1].isIntersecting),
    )
    if (node) observer.observe(node)
    return () => {
      media.removeEventListener('change', update)
      observer.disconnect()
    }
  }, [])
  useEffect(() => {
    if (!tour || reduced || !visible || hovered || view !== 'systems' || busy) return
    const id = window.setInterval(() => {
      if (document.hidden) return
      setSelected((current) => options[(options.indexOf(current) + 1) % options.length])
    }, 4200)
    return () => clearInterval(id)
  }, [tour, reduced, visible, hovered, view, options, busy])

  function choose(part: Part, pickedRack = rack) {
    setDetail(null)
    setSelected(part)
    setTour(false)
    setHovered(null)
    if (part === 'battery') {
      if (stage === 0 && !busy && pickedRack >= 0) setRack(pickedRack)
      if (view === 'systems' || view === 'enclosure') navigate('module')
      else if (view === 'module' && !busy) navigate('cells')
    } else if (view === 'enclosure' && part !== 'enclosure') navigate('systems')
  }
  function navigate(next: View) {
    transition.run(next, () => {
      setDetail(null)
      setBusy(busy || stage !== (next === 'cells' ? 2 : next === 'module' ? 1 : 0))
      setView(next)
      setTour(false)
      setHovered(null)
      setSelected(next === 'enclosure' ? 'enclosure' : 'battery')
    })
  }

  function openCell(id = selectedCell ?? 'cell-2-0') {
    transition.run('cell', () => {
      setDetail(id)
      setView('cell')
      setCellOpen(true)
      setCellPart('positive')
      setTour(false)
      setHovered(null)
    })
  }

  function chooseDetail(next: string) {
    setDetail(next)
    setTour(false)
    setHovered(null)
  }

  return (
    <div
      ref={root}
      className="container-explorer iso"
      data-theme={theme}
      lang={lang}
      onFocusCapture={(event) => {
        if (!(event.target as Element).closest('.container-tour')) setTour(false)
      }}
    >
      <div className="container-intro">
        <div>
          <p className="container-eyebrow">{c.context}</p>
          <p>{c.subtitle}</p>
        </div>
        <button
          className="container-theme"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          aria-label={theme === 'light' ? c.dark : c.light}
          title={theme === 'light' ? c.dark : c.light}
        >
          {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
        </button>
      </div>
      {linked && (
        <ExplorerSnapshot
          state={linked}
          manual={manual}
          onFollow={() => {
            setManual(false)
            setFlowMode(snapshotMode)
            setFlowPlaying(snapshotMode !== 'idle')
          }}
        />
      )}
      <div className="container-toolbar">
        <div className="container-views" role="group" aria-label={c.views}>
          {(['enclosure', 'systems', 'module', 'cells'] as const).map((key, i) => (
            <button
              key={key}
              aria-pressed={view === key || (view === 'cell' && key === 'cells')}
              onClick={() => navigate(key)}
            >
              <span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              {c[key]}
            </button>
          ))}
        </div>
        <button
          className="container-tour"
          disabled={reduced || view !== 'systems' || busy}
          aria-pressed={tour}
          onClick={() => setTour(!tour)}
        >
          {tour ? <Pause size={13} /> : <Play size={13} />}
          {tour ? c.stopTour : c.tour}
        </button>
      </div>
      <div className="container-content">
        <div className="container-art-column">
          <div
            className="iso-plate container-plate"
            data-view={
              view === 'enclosure' && !busy && stage === 0
                ? 'enclosure'
                : view === 'enclosure'
                  ? 'systems'
                  : view
            }
            data-stage={stage}
            aria-busy={transition.moving || (view === 'cell' ? cellMoving : busy)}
          >
            <div className="container-figure-heading">
              <span>{c.figure}</span>
              <span>{view === 'cell' ? c.cellView : busy ? c.moving : c[view]}</span>
            </div>
            <div
              ref={transition.scene}
              className="container-scene"
              data-transitioning={transition.moving}
              inert={transition.moving}
            >
              <div hidden={view === 'cell'}>
                <ContainerAssembly
                  key={rack}
                  enclosed={view === 'enclosure'}
                  onMoving={setBusy}
                  rack={rack}
                  target={target}
                  active={active}
                  activeDetail={annotated ? (detail ?? 'cell-2-0') : null}
                  annotated={annotated}
                  cellLabel={c.cellLabel}
                  moduleLabels={c.moduleDetails}
                  reduced={reduced}
                  visible={visible}
                  label={c.diagram}
                  names={c.parts}
                  onPick={(part, pickedRack, piece) => {
                    // In the closed view the cabinet itself is the entry to the next layer.
                    if (view === 'enclosure') {
                      if (!busy && stage === 0) navigate('systems')
                      return
                    }
                    const nextDetail = annotated ? detailForPiece(piece) : null
                    if (nextDetail) {
                      if (CELL_IDS.includes(nextDetail)) openCell(nextDetail)
                      else chooseDetail(nextDetail)
                      return
                    }
                    if (PARTS.includes(part as Part)) choose(part as Part, pickedRack)
                  }}
                  onHover={(part) =>
                    setHovered(PARTS.includes(part as Part) ? (part as Part) : null)
                  }
                  onSettled={(value) => {
                    setStage(value)
                    setBusy(false)
                  }}
                />
              </div>
              {view === 'cell' && (
                <CellCutaway
                  active={cellPart}
                  onSelect={setCellPart}
                  reduced={reduced}
                  visible={visible}
                  open={cellOpen}
                  onMoving={setCellMoving}
                  flowMode={flowMode}
                  flowPlaying={flowPlaying}
                  cameraCommand={cameraCommand}
                />
              )}
            </div>
            <div className="container-figure-bottom">
              <span>
                {view === 'cell'
                  ? c.cellCutawayHint
                  : view === 'enclosure'
                    ? c.assembledHint
                    : view === 'cells'
                      ? c.moduleHint
                      : view === 'module'
                        ? c.extractHint
                        : c.hint}
              </span>
              <span data-readout="">
                {view === 'cell'
                  ? `${c.cellLabel} ${cellNumber(selectedCell ?? 'cell-2-0')}`
                  : annotated && detail
                    ? selectedCell
                      ? `${c.cellLabel} ${cellNumber(selectedCell)}`
                      : c.moduleDetails[detail as ModuleDetail].short
                    : view === 'cells' && active === 'battery'
                      ? c.moduleBattery.short
                      : view === 'module' && active === 'battery'
                        ? c.extractedBattery.short
                        : c.parts[active].short}
              </span>
            </div>
          </div>
          {annotated && (
            <div className="module-explore">
              <div className="module-legend module-name-legend" aria-label={c.labelsHeading}>
                {MODULE_LABELS.map((label, index) => (
                  <span key={label.key}>
                    <small>{String(index + 1).padStart(2, '0')}</small>{' '}
                    {c.moduleDetails[label.key].short}
                  </span>
                ))}
              </div>
              <p className="module-cell-hint">{c.cellHint}</p>
              <button className="cell-open-action" onClick={() => openCell()}>
                {c.openCell}
                <ArrowUpRight size={15} />
              </button>
            </div>
          )}
          {view === 'cell' && (
            <div className="cell-cutaway-controls">
              <div className="cell-camera-controls" role="group" aria-label={c.camera.title}>
                <span>{c.camera.hint}</span>
                {(['out', 'in', 'reset'] as const).map((kind) => (
                  <button
                    key={kind}
                    disabled={!cellOpen || cellMoving}
                    onClick={() => setCameraCommand((previous) => ({ id: previous.id + 1, kind }))}
                  >
                    {c.camera[kind]}
                  </button>
                ))}
              </div>
              <section className="cell-flow-controls" aria-label={c.flow.title}>
                <div className="cell-flow-toolbar">
                  <div role="group" aria-label={c.flow.mode} className="cell-flow-modes">
                    {(['discharge', 'charge'] as const).map((mode) => (
                      <button
                        key={mode}
                        aria-pressed={flowMode === mode}
                        onClick={() => {
                          setFlowMode(mode)
                          setManual(true)
                        }}
                      >
                        {c.flow[mode].label}
                      </button>
                    ))}
                  </div>
                  <button
                    className="cell-flow-play"
                    disabled={reduced || !cellOpen || cellMoving || flowMode === 'idle'}
                    onClick={() => setFlowPlaying(!flowPlaying)}
                  >
                    {flowPlaying ? <Pause size={14} /> : <Play size={14} />}
                    {flowPlaying ? c.flow.pause : c.flow.play}
                  </button>
                </div>
                <div className="cell-flow-explanation" aria-live="polite" aria-atomic="true">
                  <p className="cell-flow-ions-copy">
                    <strong>{c.flow.ions}</strong> {c.flow[flowMode].ions}
                  </p>
                  <p className="cell-flow-electrons-copy">
                    <strong>{c.flow.electrons}</strong> {c.flow[flowMode].electrons}
                  </p>
                </div>
                <p className="cell-flow-note">
                  {!cellOpen || cellMoving ? c.flow.expand : reduced ? c.flow.reduced : c.flow.note}
                </p>
              </section>
              <div className="cell-materials" role="group" aria-label={c.cellMaterials}>
                {CELL_MATERIALS.map((key) => (
                  <button
                    key={key}
                    aria-pressed={cellPart === key}
                    onClick={() => setCellPart(key)}
                  >
                    {c.internalParts[key].short}
                  </button>
                ))}
              </div>
              <p className="cell-structure-note">{c.cellStructureNote}</p>
              <div className="cell-actions">
                <button onClick={() => setCellOpen(!cellOpen)}>
                  {cellOpen ? c.assembleCell : c.expandCell}
                </button>
                <button onClick={() => transition.run('cells', () => setView('cells'))}>
                  <ArrowLeft size={15} />
                  {c.backToModule}
                </button>
              </div>
              <p role="status">{cellMoving ? c.moving : cellOpen ? c.cellView : c.cell.name}</p>
            </div>
          )}
          <div className="container-motion-controls" hidden={view === 'cell'}>
            <div
              role="group"
              aria-label={c.rackSelection}
              className="container-racks"
              hidden={view === 'cells' || view === 'cell'}
            >
              {[0, 1, 2, 3].map((index) => (
                <button
                  key={index}
                  disabled={busy || stage !== 0 || view === 'enclosure'}
                  aria-pressed={rack === index}
                  onClick={() => {
                    setRack(index)
                    navigate('module')
                  }}
                >
                  {c.rack} {String(index + 1).padStart(2, '0')}
                </button>
              ))}
            </div>
            <p role="status" aria-live="polite">
              {busy ? c.moving : c.stageStatus[stage]} · {c.rack}{' '}
              {String(rack + 1).padStart(2, '0')}
            </p>
          </div>
          <div
            className="container-parts"
            hidden={view === 'cells' || view === 'cell'}
            role="group"
            aria-label={c.components}
          >
            {options.map((part) => (
              <button
                key={part}
                aria-pressed={selected === part}
                onClick={() => choose(part)}
                onFocus={() => setTour(false)}
                onPointerEnter={() => setHovered(part)}
                onPointerLeave={() => setHovered(null)}
              >
                <span aria-hidden="true">{String(PARTS.indexOf(part) + 1).padStart(2, '0')}</span>
                {view === 'cells' && part === 'battery'
                  ? c.moduleBattery.short
                  : view === 'module' && part === 'battery'
                    ? c.extractedBattery.short
                    : c.parts[part].short}
              </button>
            ))}
          </div>
        </div>
        <section ref={infoPanel} className="container-info" aria-label={info.name}>
          <p className="container-eyebrow">{info.kicker}</p>
          <h3 aria-live="polite" aria-atomic="true">
            {info.name}
          </h3>
          {selectedCell && (annotated || view === 'cell') && (
            <p className="module-cell-context">
              {c.rack} {String(rack + 1).padStart(2, '0')} · {c.cellContext}
            </p>
          )}
          <p className="container-info-body">{info.body}</p>
          <h4>{c.contains}</h4>
          <ul>
            {info.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h4>{c.role}</h4>
          <p>{info.connection}</p>
          <div className="container-drill">
            {view === 'cell' ? (
              <a
                className="cell-science-link"
                href="https://www.cei.washington.edu/research/energy-storage/lithium-ion-battery/"
                target="_blank"
                rel="noreferrer"
              >
                {c.cellReference}
                <ArrowUpRight size={14} />
              </a>
            ) : view === 'enclosure' ? (
              <button onClick={() => navigate('systems')}>
                <Layers3 size={16} />
                {c.open}
                <ArrowUpRight size={16} />
              </button>
            ) : view === 'cells' ? (
              <>
                <button onClick={() => navigate('module')}>
                  <ArrowLeft size={16} />
                  {c.reassemble}
                </button>
                <button onClick={() => navigate('systems')}>
                  <ArrowLeft size={16} />
                  {c.back}
                </button>
              </>
            ) : view === 'module' ? (
              <>
                <button onClick={() => navigate('cells')}>
                  <Layers3 size={16} />
                  {c.reveal}
                  <ArrowUpRight size={16} />
                </button>
                <button onClick={() => navigate('systems')}>
                  <ArrowLeft size={16} />
                  {c.back}
                </button>
              </>
            ) : (
              <button onClick={() => navigate('module')}>
                <Box size={16} />
                {c.inspect}
                <ArrowUpRight size={16} />
              </button>
            )}
          </div>
        </section>
      </div>
      <div className="container-specs" aria-label={c.design}>
        <div>
          <span>{c.rating}</span>
          <strong>
            {linked?.ratedMW ?? CONFIG.batteryUnitMW} MW /{' '}
            {linked?.capacityMWh ?? CONFIG.batteryUnitMWh} MWh
          </strong>
        </div>
        <div>
          <span>{c.duration}</span>
          <strong>
            {linked
              ? linked.ratedMW > 0
                ? `${(linked.capacityMWh / linked.ratedMW).toFixed(1)} ${explorerCopy[lang].hours}`
                : '—'
              : c.hours}
          </strong>
        </div>
        <div>
          <span>{c.format}</span>
          <strong>{c.feet}</strong>
        </div>
        <a href={REFERENCE} target="_blank" rel="noreferrer">
          {c.reference}
          <ArrowUpRight size={14} />
        </a>
      </div>
      <p className="container-note">{c.note}</p>
    </div>
  )
}
