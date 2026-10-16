import { useI18n } from '../../i18n'
import { NODE_BY_ID } from '../../domain/topology'
import { timeLabel } from '../../domain/config'
import type { ExplorerState } from '../../learning/explorerState'
import { explorerCopy } from '../../learning/explorerCopy'
import './explorer-snapshot.css'
export function ExplorerSnapshot({
  state,
  manual = false,
  onFollow,
}: {
  state: ExplorerState
  manual?: boolean
  onFollow?: () => void
}) {
  const { lang, l, t } = useI18n(),
    c = explorerCopy[lang]
  return (
    <section
      className="explorer-snapshot"
      data-testid="explorer-snapshot"
      data-node={state.nodeId}
      data-mode={state.mode}
      data-ratio={state.speedRatio}
      data-minute={state.minute}
      data-manual={manual}
    >
      <strong>
        {state.source === 'simulation' ? c.snapshot : c.live} · {timeLabel(state.minute)} ·{' '}
        {l(NODE_BY_ID[state.nodeId].name)}
      </strong>
      <span>
        {t.scenarios[state.scenarioId].name} · {c.states[state.mode]}
      </span>
      <span>
        {c.output}: {state.mode === 'unavailable' ? '—' : state.powerMW.toFixed(2)} MW · {c.rating}:{' '}
        {state.ratedMW.toFixed(2)} MW
      </span>
      {state.nodeId.startsWith('wind-') && (
        <>
          <strong>
            {c.schematic}: {state.speedRatio.toFixed(2)}×
          </strong>
          <small>{c.speedNote}</small>
        </>
      )}
      {onFollow && (
        <div>
          <strong>{manual ? c.manual : c.following}</strong>
          {manual && <button onClick={onFollow}>{c.follow}</button>}
        </div>
      )}
      <small>{c.fixed}</small>
    </section>
  )
}
