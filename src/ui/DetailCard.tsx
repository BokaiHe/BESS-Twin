import { Term } from './learning/Term'
import {
  ArrowLeft,
  BatteryCharging,
  Factory,
  Home,
  RadioTower,
  Sun,
  TriangleAlert,
  Waypoints,
  Wind,
  X,
  Zap,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { configFor } from '../domain/parameters'
import { useMemo } from 'react'
import { topologyFor } from '../domain/topology'
import { BESS_IDS, EDGES, NODE_BY_ID, connectedEdgeIds } from '../domain/topology'
import type { NodeId, NodeKind, Snapshot } from '../domain/types'
import { useI18n } from '../i18n'
import type { Selection } from '../components/scene/shared'
import { VoltageInfo } from './VoltageInfo'
import { TONE, clusterMode, modeText, modeTone, mw, priceText, unitMode } from './format'

const KIND_ICON: Record<NodeKind, typeof Sun> = {
  grid: RadioTower,
  transformer: Waypoints,
  bus: Zap,
  pv: Sun,
  wind: Wind,
  bess: BatteryCharging,
  factory: Factory,
  residential: Home,
}

function Row({ label, children, tone }: { label: ReactNode; children: ReactNode; tone?: string }) {
  return (
    <div className="row" style={tone ? { ['--tone' as string]: tone } : undefined}>
      <dt>{label}</dt>
      <dd className={tone ? 'tone' : ''}>{children}</dd>
    </div>
  )
}

function SocRing({
  value,
  tone,
  applicable = true,
}: {
  value: number
  tone: string
  applicable?: boolean
}) {
  const r = 34,
    c = 2 * Math.PI * r
  return (
    <svg
      className="soc-ring"
      viewBox="0 0 84 84"
      role="img"
      aria-label={applicable ? `SOC ${value.toFixed(0)}%` : 'SOC N/A'}
    >
      <circle cx="42" cy="42" r={r} className="track" />
      <circle
        cx="42"
        cy="42"
        r={r}
        className="value"
        style={{ stroke: tone, strokeDasharray: c, strokeDashoffset: c * (1 - value / 100) }}
      />
      <text x="42" y="40" textAnchor="middle" className="ring-num" data-testid="detail-soc">
        {applicable ? value.toFixed(0) : 'N/A'}
        {applicable && <tspan className="ring-unit">%</tspan>}
      </text>
      <text x="42" y="56" textAnchor="middle" className="ring-cap">
        SOC
      </text>
    </svg>
  )
}

function Strategy({ snapshot }: { snapshot: Snapshot }) {
  const { t } = useI18n()
  const s = snapshot.strategy
  return (
    <div className="strategy">
      <div className="strategy-head">
        <span className="pulse-dot" />
        <span>{t.detail.strategy}</span>
        <strong>{t.strategy[s.code]}</strong>
        {s.replanned && <em>{t.replanned}</em>}
      </div>
      <p>{t.strategyReason[s.code](s.peakLevelMW.toFixed(1))}</p>
      <div className="strategy-meta">
        <span>
          {t.detail.level} <b>{s.peakLevelMW.toFixed(1)} MW</b>
        </span>
        {s.chargeTargetMWh !== null && (
          <span>
            {t.detail.target} <b>{s.chargeTargetMWh.toFixed(1)} MWh</b>
          </span>
        )}
      </div>
    </div>
  )
}

function Lines({ id, snapshot }: { id: NodeId; snapshot: Snapshot }) {
  const { t, l } = useI18n()
  const ids = connectedEdgeIds(id)
  return (
    <div className="lines">
      <h3>{t.detail.lines}</h3>
      {EDGES.filter((e) => ids.includes(e.id)).map((e) => {
        const p = snapshot.edges[e.id].powerMW
        const from = p < 0 ? e.to : e.from,
          to = p < 0 ? e.from : e.to
        const util = Math.min(100, snapshot.edges[e.id].activeUtilizationPct)
        return (
          <div className="line" key={e.id}>
            <div>
              <span>
                {l(NODE_BY_ID[from].name)} {t.detail.lineFrom} {l(NODE_BY_ID[to].name)}
              </span>
              <b>{mw(p, 2)} MW</b>
            </div>
            <div className="bar">
              <i style={{ width: `${util}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AlarmBox({ snapshot, id }: { snapshot: Snapshot; id?: NodeId }) {
  const { t } = useI18n()
  const alarms = snapshot.alarms.filter((a) => !id || a.nodeId === id)
  if (!alarms.length) return null
  return (
    <>
      {alarms.map((a) => (
        <div key={a.id} className={`alarm-box ${a.severity}`}>
          <TriangleAlert size={16} />
          <div>
            <strong>{t.alarms[a.code].title}</strong>
            <p>{t.alarms[a.code].impact}</p>
          </div>
        </div>
      ))}
    </>
  )
}

export function DetailCard({
  selection,
  snapshot,
  onSelect,
  onClose,
  onInspect,
}: {
  selection: Selection
  snapshot: Snapshot
  onSelect: (s: Selection) => void
  onClose: () => void
  onInspect: () => void
}) {
  const { t, l, lang } = useI18n()
  const m = snapshot.metrics
  const CONFIG = configFor(snapshot.parameters)
  const INSTALLED_MW = snapshot.parameters.batteryMW
  const INSTALLED_MWH = snapshot.parameters.batteryMWh
  const model = useMemo(() => topologyFor(snapshot.parameters), [snapshot.parameters])

  let icon: ReactNode, eyebrow: string, title: string, pill: ReactNode, body: ReactNode
  if (selection === 'bess-cluster') {
    const mode = clusterMode(snapshot)
    const tone = modeTone(mode)
    icon = <BatteryCharging size={20} />
    eyebrow = t.detail.overview
    title = t.labels.bessPlant
    pill = (
      <span className="pill" style={{ ['--tone' as string]: tone }}>
        {modeText(t, mode)}
      </span>
    )
    body = (
      <>
        <div className="hero">
          <SocRing value={m.socPct} tone={tone} applicable={INSTALLED_MWH > 0} />
          <div className="hero-stats">
            <span className="hero-label">{t.detail.power}</span>
            <strong style={{ color: tone }}>
              {mw(m.batteryChargeMW + m.batteryDischargeMW)}
              <small> MW</small>
            </strong>
            <span className="hero-sub">
              {t.detail.stored} {m.storedMWh.toFixed(1)} / {INSTALLED_MWH} MWh
            </span>
          </div>
        </div>
        <div className="units">
          <h3>{t.detail.units}</h3>
          <div className="unit-grid">
            {BESS_IDS.map((id, i) => {
              const s = snapshot.nodes[id]
              const um = unitMode(snapshot, id)
              const warn = snapshot.alarms.some((a) => a.nodeId === id)
              return (
                <button
                  key={id}
                  className={`unit${warn ? ' is-alert' : ''}`}
                  style={{ ['--tone' as string]: modeTone(um) }}
                  onClick={() => onSelect(id)}
                >
                  <span className="unit-bar">
                    <i style={{ height: `${s.socPct}%` }} />
                  </span>
                  <b>0{i + 1}</b>
                  <small>
                    {um === 'offline'
                      ? t.flow.offline
                      : INSTALLED_MWH
                        ? `${s.socPct!.toFixed(0)}%`
                        : t.study.na}
                  </small>
                </button>
              )
            })}
          </div>
        </div>
        <dl className="rows">
          <Row label={t.detail.online}>
            {m.onlinePowerLimitMW} / {INSTALLED_MW} MW · {m.onlineCapacityMWh} / {INSTALLED_MWH} MWh
          </Row>
          <Row label={<Term id="available-power">{t.detail.available}</Term>}>
            {mw(m.availableDischargeMW)} MW
          </Row>
          <Row label={t.detail.reserve}>{snapshot.strategy.reserveMWh.toFixed(1)} MWh</Row>
        </dl>
        <Strategy snapshot={snapshot} />
        <AlarmBox snapshot={snapshot} />
      </>
    )
  } else {
    const node = model.nodeById[selection]
    const state = snapshot.nodes[selection]
    const Icon = KIND_ICON[node.kind]
    icon = <Icon size={20} />
    eyebrow = t.kinds[node.kind]
    title = l(node.name)
    const rowsBase = (
      <>
        <Row label={t.detail.rating}>{l(node.rating)}</Row>
      </>
    )
    if (node.kind === 'bess') {
      const um = unitMode(snapshot, selection)
      const tone = modeTone(um)
      const hot = (state.temperatureC ?? 0) >= CONFIG.tempWarningC
      pill = (
        <span className="pill" style={{ ['--tone' as string]: tone }}>
          {modeText(t, um)}
        </span>
      )
      body = (
        <>
          <div className="hero">
            <SocRing value={state.socPct ?? 0} tone={tone} applicable={INSTALLED_MWH > 0} />
            <div className="hero-stats">
              <span className="hero-label">{t.detail.power}</span>
              <strong style={{ color: tone }}>
                {mw(state.injectionMW)}
                <small> MW</small>
              </strong>
              <span className="hero-sub">
                {((state.socPct! / 100) * CONFIG.batteryUnitMWh).toFixed(2)} /{' '}
                {CONFIG.batteryUnitMWh} MWh
              </span>
            </div>
          </div>
          <dl className="rows">
            <Row label={t.detail.temp} tone={hot ? TONE.alarm : undefined}>
              {state.temperatureC?.toFixed(1)} °C
            </Row>
            <Row label={<Term id="soh">{t.detail.soh}</Term>}>{state.sohPct}%</Row>
            <Row label={<Term id="available-power">{t.detail.available}</Term>}>
              {mw(state.availableDischargeMW ?? 0, 2)} MW
            </Row>
            {rowsBase}
          </dl>
          <AlarmBox snapshot={snapshot} id={selection} />
          <button className="link-btn" onClick={() => onSelect('bess-cluster')}>
            <ArrowLeft size={14} /> {t.detail.backToCluster}
          </button>
        </>
      )
    } else {
      let hero: ReactNode = null
      let rows: ReactNode = null
      const heroBlock = (
        label: string,
        value: number,
        tone: string,
        sub?: string,
        fill?: number,
      ) => (
        <div className="hero hero-flat">
          <div className="hero-stats">
            <span className="hero-label">{label}</span>
            <strong style={{ color: tone }}>
              {mw(value)}
              <small> MW</small>
            </strong>
            {sub && <span className="hero-sub">{sub}</span>}
          </div>
          {fill !== undefined && (
            <div className="meter" style={{ ['--tone' as string]: tone }}>
              <i style={{ width: `${Math.min(100, fill * 100)}%` }} />
            </div>
          )}
        </div>
      )
      if (node.kind === 'pv') {
        hero = heroBlock(
          t.detail.output,
          m.pvMW,
          TONE.renewable,
          `${t.detail.capacityFactor} ${(CONFIG.pvACMW ? (m.pvMW / CONFIG.pvACMW) * 100 : 0).toFixed(0)}%`,
          CONFIG.pvACMW ? m.pvMW / CONFIG.pvACMW : 0,
        )
        rows = (
          <>
            <Row label={t.detail.dcPotential}>{mw(m.pvDcPotentialMW, 2)} MW</Row>
            <Row label={t.detail.clipping}>{mw(m.pvClippingMW, 2)} MW</Row>
          </>
        )
      } else if (node.kind === 'wind') {
        hero = heroBlock(
          t.detail.output,
          state.injectionMW,
          TONE.renewable,
          `${t.detail.capacityFactor} ${(CONFIG.windUnitMW ? (state.injectionMW / CONFIG.windUnitMW) * 100 : 0).toFixed(0)}%`,
          CONFIG.windUnitMW ? state.injectionMW / CONFIG.windUnitMW : 0,
        )
      } else if (node.kind === 'grid' || selection === 'pcc') {
        const imp = m.gridImportMW > 0.01
        hero = heroBlock(
          imp ? t.flow.import : m.gridExportMW > 0.01 ? t.flow.export : t.flow.none,
          m.gridImportMW + m.gridExportMW,
          TONE.grid,
          `${t.tariffLong[snapshot.tariff.band]} ${priceText(snapshot.tariff.importCnyPerKWh, lang)}/kWh`,
          (m.gridImportMW + m.gridExportMW) /
            (Math.max(CONFIG.gridImportLimitMW, CONFIG.gridExportLimitMW) || 1),
        )
        rows = (
          <>
            <Row label={t.detail.importP}>{mw(m.gridImportMW, 2)} MW</Row>
            <Row label={t.detail.exportP}>{mw(m.gridExportMW, 2)} MW</Row>
            <Row label={t.detail.limit}>
              {t.flow.import} {CONFIG.gridImportLimitMW} / {t.flow.export}{' '}
              {CONFIG.gridExportLimitMW} MW
            </Row>
          </>
        )
      } else if (node.kind === 'factory' || node.kind === 'residential') {
        const load = -state.injectionMW
        hero = heroBlock(
          t.detail.loadNow,
          load,
          TONE.grid,
          `${t.detail.share} ${((load / m.demandMW) * 100).toFixed(0)}%`,
          load / (node.kind === 'factory' ? 14 : 5),
        )
      } else {
        const through =
          snapshot.edges[
            connectedEdgeIds(selection).find(
              (e) => EDGES.find((x) => x.id === e)!.to === selection,
            ) ?? ''
          ]?.powerMW
        hero = heroBlock(t.detail.throughput, through ?? m.servedMW, TONE.grid)
      }
      pill = (
        <span className="pill" style={{ ['--tone' as string]: TONE.renewable }}>
          {t.flow.running}
        </span>
      )
      body = (
        <>
          {hero}
          <dl className="rows">
            {rows}
            {rowsBase}
          </dl>
          <Lines id={selection} snapshot={snapshot} />
        </>
      )
    }
  }

  return (
    <aside className="card detail" aria-label={title}>
      <header className="detail-head">
        <span className="detail-icon">{icon}</span>
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        {pill}
        <button className="icon-btn" aria-label={t.close} onClick={onClose}>
          <X size={15} />
        </button>
      </header>
      <div className="detail-body">
        <VoltageInfo selection={selection} />
        {(selection === 'bess-cluster' ||
          selection.startsWith('bess-') ||
          selection === 'pv' ||
          selection.startsWith('wind-')) && (
          <button className="container-entry" onClick={onInspect}>
            <span aria-hidden="true">
              {selection === 'pv' ? (
                <Sun size={18} />
              ) : selection.startsWith('wind-') ? (
                <Wind size={18} />
              ) : (
                <BatteryCharging size={18} />
              )}
            </span>
            <span>
              {selection === 'pv' || selection.startsWith('wind-')
                ? t.exploreEquipment
                : t.exploreInside}
            </span>
            <span aria-hidden="true">↗</span>
          </button>
        )}
        {body}
      </div>
    </aside>
  )
}

export const kindIcon = (kind: NodeKind) => KIND_ICON[kind]
