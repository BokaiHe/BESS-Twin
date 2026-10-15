import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { NODES } from '../domain/topology'
import type { NodeId, NodeKind, Snapshot } from '../domain/types'
import { useI18n } from '../i18n'
import type { Selection } from '../components/scene/shared'
import { VoltageInfo } from './VoltageInfo'
import { kindIcon } from './DetailCard'
import { TONE, modeText, modeTone, mw, unitMode } from './format'

type Group = 'gen' | 'grid' | 'storage' | 'load'
const GROUP_KINDS: Record<Group, NodeKind[]> = {
  gen: ['pv', 'wind'],
  grid: ['grid', 'transformer', 'bus'],
  storage: ['bess'],
  load: ['factory', 'residential'],
}

export function DeviceList({
  snapshot,
  selected,
  onSelect,
}: {
  snapshot: Snapshot
  selected: Selection | null
  onSelect: (s: Selection) => void
}) {
  const { t, l } = useI18n()
  const [group, setGroup] = useState<Group>('storage')
  const nodes = NODES.filter((n) => GROUP_KINDS[group].includes(n.kind))
  const status = (id: NodeId, kind: NodeKind) => {
    const s = snapshot.nodes[id]
    if (kind === 'bess') {
      const mode = unitMode(snapshot, id)
      const alert = snapshot.alarms.some((a) => a.nodeId === id)
      return { text: modeText(t, mode), tone: alert ? TONE.alarm : modeTone(mode) }
    }
    if (kind === 'pv' || kind === 'wind')
      return s.injectionMW > 0.01
        ? { text: t.flow.running, tone: TONE.renewable }
        : { text: t.flow.stopped, tone: TONE.idle }
    if (kind === 'factory' || kind === 'residential')
      return snapshot.metrics.unservedMW > 0.001
        ? { text: t.kpi.shortfall, tone: TONE.alarm }
        : { text: t.flow.supplied, tone: TONE.grid }
    if (kind === 'grid') {
      const m = snapshot.metrics
      return m.gridImportMW > 0.01
        ? { text: t.flow.import, tone: TONE.grid }
        : m.gridExportMW > 0.01
          ? { text: t.flow.export, tone: TONE.renewable }
          : { text: t.flow.none, tone: TONE.idle }
    }
    return { text: t.flow.running, tone: TONE.grid }
  }
  const value = (id: NodeId, kind: NodeKind) => {
    const s = snapshot.nodes[id]
    if (kind === 'bess')
      return snapshot.parameters.batteryMWh ? `${s.socPct!.toFixed(0)}%` : t.study.na
    if (kind === 'transformer' || kind === 'bus') return ''
    return `${mw(s.injectionMW)} MW`
  }
  return (
    <section className="card devices" aria-label={t.groups[group]}>
      <div className="tabs" role="tablist">
        {(Object.keys(GROUP_KINDS) as Group[]).map((g) => (
          <button
            key={g}
            role="tab"
            aria-selected={g === group}
            className={g === group ? 'is-active' : ''}
            onClick={() => setGroup(g)}
          >
            {t.groups[g]}
            <small>{NODES.filter((n) => GROUP_KINDS[g].includes(n.kind)).length}</small>
          </button>
        ))}
      </div>
      <div className="device-rows">
        {nodes.map((n) => {
          const Icon = kindIcon(n.kind)
          const st = status(n.id, n.kind)
          const s = snapshot.nodes[n.id]
          return (
            <button
              key={n.id}
              className={`device-row${selected === n.id ? ' is-selected' : ''}`}
              onClick={() => onSelect(n.id)}
            >
              <span className="device-icon">
                <Icon size={14} />
              </span>
              <span className="device-name">
                <strong>{l(n.name)}</strong>
              </span>
              <span className="pill sm" style={{ ['--tone' as string]: st.tone }}>
                {st.text}
              </span>
              <span className="device-value">
                {value(n.id, n.kind)}
                {n.kind === 'bess' && (
                  <span className="mini-bar" style={{ ['--tone' as string]: st.tone }}>
                    <i style={{ width: `${s.socPct}%` }} />
                  </span>
                )}
              </span>
              <ChevronRight size={14} className="chev" />
              <VoltageInfo selection={n.id} compact />
            </button>
          )
        })}
      </div>
    </section>
  )
}
