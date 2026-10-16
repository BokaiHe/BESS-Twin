import { markActivity } from '../../learning/progress'
import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, Sankey, type SankeyLinkProps, type SankeyNodeProps } from 'recharts'
import type { SimulationDay } from '../../domain/types'
import { timeLabel } from '../../domain/config'
import { useI18n } from '../../i18n'
import { flowCopy } from '../../learning/copy'
import {
  energyFlows,
  FLOW_SOURCES,
  FLOW_SINKS,
  type SourceKey,
  type SinkKey,
} from '../../simulation/energyFlows'
import { Modal } from '../Modal'
import { TONE } from '../format'
import './energy-flows.css'

type FlowKey = SourceKey | SinkKey
const colors: Record<FlowKey, string> = {
  pv: TONE.renewable,
  wind: TONE.renewable,
  gridImport: TONE.grid,
  batteryDischarge: TONE.discharge,
  load: '#64748b',
  batteryCharge: TONE.charge,
  gridExport: TONE.grid,
}
export default function EnergyFlowChart({
  day,
  minute,
  initialScope = 'day',
  busy,
  error,
  onClose,
}: {
  day: SimulationDay
  minute: number
  initialScope?: 'day' | 'now'
  busy: boolean
  error: string
  onClose: () => void
}) {
  useEffect(() => markActivity('flows'), [])
  const { lang, t } = useI18n()
  const c = flowCopy[lang]
  const [scope, setScope] = useState(initialScope)
  const [selected, setSelected] = useState<string | null>(null)
  const end = scope === 'day' ? day.frames.length : minute
  const result = useMemo(() => energyFlows(day, 0, end), [day, end])
  const number = (n: number) =>
    n > 0 && n < 0.001
      ? '<0.001'
      : n.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
          minimumFractionDigits: 3,
          maximumFractionDigits: 3,
        })
  const energy = (n: number) => `${number(n)} MWh`
  const data = useMemo(() => {
    const nodes = [
      ...FLOW_SOURCES.filter((k) => result.sources[k] > 0).map((key) => ({
        key,
        side: 'source',
        value: result.sources[key],
      })),
      ...FLOW_SINKS.filter((k) => result.sinks[k] > 0).map((key) => ({
        key,
        side: 'sink',
        value: result.sinks[key],
      })),
    ]
    return {
      nodes,
      links: result.flows
        .filter((f) => f.mwh > 0)
        .map((f) => ({
          source: nodes.findIndex((n) => n.key === f.from),
          target: nodes.findIndex((n) => n.key === f.to),
          value: f.mwh,
          from: f.from,
          to: f.to,
        })),
    }
  }, [result])
  const route = result.flows.find((f) => `${f.from}-${f.to}` === selected)
  const name = (from: SourceKey, to: SinkKey, value: number) =>
    `${c.labels[from]} → ${c.labels[to]}: ${energy(value)}`
  const renderNode = ({ x, y, width, height, index }: SankeyNodeProps) => {
    const node = data.nodes[index],
      source = node.side === 'source'
    const textX = source ? x - 7 : x + width + 7
    return (
      <g data-flow-node={node.key}>
        <rect
          x={x}
          y={y}
          width={width}
          height={Math.max(height, 1)}
          fill={colors[node.key]}
          rx={2}
        />
        <text
          x={textX}
          y={y + height / 2 - 3}
          textAnchor={source ? 'end' : 'start'}
          className="energy-node-label"
        >
          {c.short[node.key]}
          <tspan x={textX} dy="14" className="energy-node-value">
            {number(node.value)}
          </tspan>
        </text>
      </g>
    )
  }
  const renderLink = (p: SankeyLinkProps) => {
    const link = data.links[p.index],
      key = `${link.from}-${link.to}`
    const label = name(link.from, link.to, link.value)
    return (
      <path
        d={`M ${p.sourceX} ${p.sourceY} C ${p.sourceControlX} ${p.sourceY}, ${p.targetControlX} ${p.targetY}, ${p.targetX} ${p.targetY}`}
        fill="none"
        stroke={link.to === 'batteryCharge' ? TONE.charge : colors[link.from]}
        strokeWidth={Math.max(p.linkWidth, 0.5)}
        className={`energy-band${selected === key ? ' is-selected' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-pressed={selected === key}
        data-flow-link={key}
        onClick={() => setSelected(key)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setSelected(key)
          }
        }}
      >
        <title>{label}</title>
      </path>
    )
  }
  return (
    <Modal title={c.title} onClose={onClose} wide className="energy-flow-modal">
      <div className="energy-flows" data-testid="energy-flows" data-end-minute={end}>
        <p>{c.intro}</p>
        <p className="energy-context">
          {t.scenarios[day.id].name} · {day.parameters.batteryMW} MW / {day.parameters.batteryMWh}{' '}
          MWh · 00:00–{end === day.frames.length ? '24:00' : timeLabel(end)}
        </p>
        {(busy || error) && (
          <p className="study-status" role="status">
            {error || t.study.computing}
          </p>
        )}
        <div className="seg energy-scope" role="group" aria-label={c.scope}>
          <button
            aria-pressed={scope === 'day'}
            className={scope === 'day' ? 'is-active' : ''}
            onClick={() => {
              setScope('day')
              setSelected(null)
            }}
          >
            {c.day}
          </button>
          <button
            aria-pressed={scope === 'now'}
            className={scope === 'now' ? 'is-active' : ''}
            onClick={() => {
              setScope('now')
              setSelected(null)
            }}
          >
            {c.now} {timeLabel(minute)}
          </button>
        </div>
        <p className="energy-note">{c.windowNote}</p>
        <div className="energy-columns">
          <strong>{c.sources}</strong>
          <span>MWh →</span>
          <strong>{c.sinks}</strong>
        </div>
        {data.links.length ? (
          <div className="energy-sankey" role="group" aria-label={c.title}>
            <ResponsiveContainer width="100%" height={340} minWidth={0}>
              <Sankey
                data={data}
                nodeWidth={10}
                nodePadding={30}
                margin={{ left: 78, right: 78, top: 20, bottom: 20 }}
                sort={false}
                iterations={16}
                node={renderNode}
                link={renderLink}
                accessibilityLayer={false}
              />
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="energy-empty" role="status">
            {c.empty}
          </p>
        )}
        <p className="energy-selection" role="status">
          {route ? name(route.from, route.to, route.mwh) : c.select}
        </p>
        <details className="energy-table">
          <summary>{c.table}</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">{c.from}</th>
                <th scope="col">{c.to}</th>
                <th scope="col">{c.energy}</th>
              </tr>
            </thead>
            <tbody>
              {result.flows.map((f) => (
                <tr key={`${f.from}-${f.to}`} data-flow-row={`${f.from}-${f.to}`}>
                  <th scope="row">{c.labels[f.from]}</th>
                  <td>{c.labels[f.to]}</td>
                  <td>{number(f.mwh)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="energy-totals">
            <div>
              <h3>{c.sources}</h3>
              <dl>
                {FLOW_SOURCES.filter((key) => result.sources[key] > 0).map((key) => (
                  <div key={key}>
                    <dt>{c.labels[key]}</dt>
                    <dd>{energy(result.sources[key])}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h3>{c.sinks}</h3>
              <dl>
                {FLOW_SINKS.filter((key) => result.sinks[key] > 0).map((key) => (
                  <div key={key}>
                    <dt>{c.labels[key]}</dt>
                    <dd>{energy(result.sinks[key])}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </details>
        <section className="energy-outside">
          <h3>{c.outside}</h3>
          <dl>
            {(['curtailed', 'clipping', 'unserved'] as const).map((key) => (
              <div key={key}>
                <dt>{c[key]}</dt>
                <dd data-testid={`flow-${key}`}>{energy(result.lost[key])}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="energy-storage">
          <h3>{c.storage}</h3>
          <dl>
            {(
              [
                ['initial', result.storage.initialMWh],
                ['final', result.storage.finalMWh],
                ['delta', result.storage.deltaMWh],
                ['loss', result.storage.lossMWh],
              ] as const
            ).map(([key, value]) => (
              <div key={key}>
                <dt>{c[key]}</dt>
                <dd data-testid={`flow-${key}`}>{energy(value)}</dd>
              </div>
            ))}
          </dl>
          <p className="energy-note">{c.lossFormula}</p>
          <p className="energy-equation">
            {number(result.sinks.batteryCharge)} − {number(result.sources.batteryDischarge)} − (
            {number(result.storage.deltaMWh)}) = {energy(result.storage.lossMWh)}
          </p>
          <p className="energy-note">{c.inventoryNote}</p>
        </section>
        {result.diagnostics.batteryExportMWh > 0 && (
          <p role="status">
            {c.unexpectedExport} {energy(result.diagnostics.batteryExportMWh)}
          </p>
        )}
      </div>
    </Modal>
  )
}
