import { LockKeyhole } from 'lucide-react'
import type { ChallengeId } from '../learning/progress'
import { LazyStorageTank } from './learning/LazyStorageTank'
import { Term } from './learning/Term'
import { parameterTerms } from '../learning/termLinks'
import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  DEFAULT_PARAMETERS,
  PARAMETER_RULES,
  type ParameterKey,
  type SimulationParameters,
} from '../domain/parameters'
import { timeLabel } from '../domain/config'
import type { ScenarioId, SimulationDay } from '../domain/types'
import type { StudyResult } from '../data/studyProtocol'
import { compareDays } from '../simulation/comparison'
import { useI18n } from '../i18n'
import { currencyCode, displayMoney } from './format'

function ParameterField({
  name,
  locked,
  value,
  onChange,
}: {
  locked?: string
  name: ParameterKey
  value: number
  onChange: (n: number, debounce?: boolean) => void
}) {
  const { t } = useI18n()
  const rule = PARAMETER_RULES[name]
  const [typed, setTyped] = useState(String(value))
  useEffect(() => setTyped(String(value)), [value])
  const commit = () => {
    if (locked) return
    const n = typed.trim() ? Number(typed) : NaN
    const rounded = Number.isFinite(n)
      ? Number(
          (Math.round(Math.max(rule.min, Math.min(rule.max, n)) / rule.step) * rule.step).toFixed(
            6,
          ),
        )
      : value
    setTyped(String(rounded))
    onChange(rounded, false)
  }
  return (
    <div className="parameter-field">
      <div className="parameter-label">
        <Term id={parameterTerms[name]}>{t.study.labels[name]}</Term> <small>{rule.unit}</small>
        {locked && (
          <span className="parameter-lock" title={locked}>
            <LockKeyhole size={12} />
            <span className="sr-only">{locked}</span>
          </span>
        )}
      </div>
      <div>
        <input
          disabled={!!locked}
          id={`range-${name}`}
          aria-label={t.study.labels[name]}
          data-testid={`parameter-${name}`}
          type="range"
          min={rule.min}
          max={rule.max}
          step={rule.step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <input
          disabled={!!locked}
          type="number"
          aria-label={`${t.study.labels[name]} (${t.study.number})`}
          min={rule.min}
          max={rule.max}
          step={rule.step}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
      </div>
    </div>
  )
}

function SolverSummary({ day }: { day: SimulationDay }) {
  const { t } = useI18n()
  const s = day.diagnostics.solver
  return (
    <div className="solver-summary">
      <strong>
        {s.status === 'converged'
          ? t.study.converged
          : s.status === 'not-converged'
            ? t.study.notConverged
            : t.study.notApplicable}
      </strong>
      <span>
        {s.iterations} {t.study.iterations} · {t.study.residual} {s.residualMWh.toFixed(6)} MWh
      </span>
      {day.id === 'fault' && <span>{t.study.faultInit}</span>}
    </div>
  )
}

export function DesignStudy({
  proposal,
  onChange,
  onPin,
  result,
  busy,
  error,
  scenario,
  onScenario,
  onRetry,
  mode = 'free',
  challengeRules,
}: {
  mode?: 'free' | { challenge: ChallengeId }
  challengeRules?: {
    editable: readonly ParameterKey[]
    start: SimulationParameters
    lockedText: string
  }
  proposal: SimulationParameters
  onChange: (p: SimulationParameters, debounce?: boolean) => void
  onPin: () => void
  result: StudyResult
  busy: boolean
  error: string
  scenario: ScenarioId
  onRetry: () => void
  onScenario: (s: ScenarioId) => void
}) {
  const { t, lang } = useI18n()
  const c = t.study
  const comparison = useMemo(() => compareDays(result.original, result.proposal), [result])
  const [chartKind, setChartKind] = useState<'energy' | 'grid' | 'unserved'>('energy')
  const data = useMemo(() => {
    const rows = result.original.frames.map((a, i) => {
      const b = result.proposal.frames[i]
      return {
        minute: i,
        a: a.metrics.storedMWh,
        b: b.metrics.storedMWh,
        aSoc: result.original.parameters.batteryMWh ? a.metrics.socPct : null,
        bSoc: result.proposal.parameters.batteryMWh ? b.metrics.socPct : null,
        aGrid: a.metrics.gridImportMW,
        bGrid: b.metrics.gridImportMW,
        aUnserved: a.metrics.unservedMW,
        bUnserved: b.metrics.unservedMW,
      }
    })
    const last = rows.at(-1)!
    rows.push({
      ...last,
      minute: 1440,
      a: result.original.summary.finalStoredMWh,
      b: result.proposal.summary.finalStoredMWh,
      aSoc: result.original.parameters.batteryMWh
        ? (result.original.summary.finalStoredMWh / result.original.parameters.batteryMWh) * 100
        : null,
      bSoc: result.proposal.parameters.batteryMWh
        ? (result.proposal.summary.finalStoredMWh / result.proposal.parameters.batteryMWh) * 100
        : null,
    })
    return rows
  }, [result])
  const amounts = (value: number) =>
    new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(value)
  const original = result.original,
    applied = result.proposal
  const offline = (day: SimulationDay) => {
    const m = day.frames[1439].metrics
    return Math.max(0, m.storedMWh - (m.onlineCapacityMWh * m.onlineSocPct) / 100)
  }
  const rows = [
    [
      c.bill,
      displayMoney(original.summary.costCny, lang),
      displayMoney(applied.summary.costCny, lang),
      currencyCode(lang),
    ],
    [c.peak, comparison.originalPeakMW, comparison.proposalPeakMW, 'MW'],
    [c.unserved, original.summary.unservedMWh, applied.summary.unservedMWh, 'MWh'],
    [c.curtailment, original.summary.curtailedMWh, applied.summary.curtailedMWh, 'MWh'],
    [c.clipping, original.summary.clippingMWh, applied.summary.clippingMWh, 'MWh'],
    [c.initial, original.summary.initialStoredMWh, applied.summary.initialStoredMWh, 'MWh'],
    [c.final, original.summary.finalStoredMWh, applied.summary.finalStoredMWh, 'MWh'],
    [
      c.delta,
      original.summary.finalStoredMWh - original.summary.initialStoredMWh,
      applied.summary.finalStoredMWh - applied.summary.initialStoredMWh,
      'MWh',
    ],
    [c.offline, offline(original), offline(applied), 'MWh'],
  ] as const
  const fields = (keys: ParameterKey[]) =>
    keys.map((key) => (
      <ParameterField
        key={key}
        name={key}
        locked={
          mode !== 'free' && !challengeRules?.editable.includes(key)
            ? challengeRules?.lockedText
            : undefined
        }
        value={proposal[key]}
        onChange={(value, debounce) => onChange({ ...proposal, [key]: value }, debounce)}
      />
    ))
  const power = chartKind !== 'energy'
  const series =
    chartKind === 'energy'
      ? ['a', 'b']
      : chartKind === 'grid'
        ? ['aGrid', 'bGrid']
        : ['aUnserved', 'bUnserved']
  return (
    <div className="design-study">
      <p>{c.intro}</p>
      <div className="study-toolbar">
        <label>
          {c.scenario}{' '}
          <select
            disabled={mode !== 'free'}
            aria-label={c.scenario}
            value={scenario}
            onChange={(e) => onScenario(e.target.value as ScenarioId)}
          >
            {(['sunny', 'cloudy', 'fault'] as const).map((id) => (
              <option key={id} value={id}>
                {t.scenarios[id].name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="pill-btn"
          onClick={() =>
            onChange(mode === 'free' ? DEFAULT_PARAMETERS : challengeRules!.start, false)
          }
        >
          {c.reset}
        </button>
        {mode === 'free' && (
          <button className="pill-btn" disabled={busy || !!error} onClick={onPin}>
            {c.pin}
          </button>
        )}
      </div>
      <p
        className={`study-status${busy ? ' is-busy' : ''}`}
        role="status"
        data-testid="study-status"
      >
        {error || (busy ? c.computing : c.ready)}
        {error && (
          <button className="pill-btn" onClick={onRetry}>
            {c.retry}
          </button>
        )}
      </p>
      <div className="study-layout">
        <section className="study-inputs" aria-label={c.proposal}>
          <h3>{c.proposal}</h3>
          <div className="study-rating" data-testid="draft-rating">
            <strong>
              {proposal.batteryMW} MW / {proposal.batteryMWh} MWh
            </strong>
            <span>
              {c.duration}:{' '}
              {proposal.batteryMW
                ? `${(proposal.batteryMWh / proposal.batteryMW).toFixed(1)} ${c.hours}`
                : c.na}
            </span>
            <span>
              {c.pvAc}: {(proposal.pvDCMWp / 1.25).toFixed(1)} MWac
            </span>
          </div>
          <LazyStorageTank
            preview
            capacityMWh={proposal.batteryMWh}
            ratedMW={proposal.batteryMW}
            socMinPct={proposal.socMinPct}
            socMaxPct={proposal.socMaxPct}
            compareTo={{
              capacityMWh: original.parameters.batteryMWh,
              ratedMW: original.parameters.batteryMW,
            }}
          />
          {fields((Object.keys(PARAMETER_RULES) as ParameterKey[]).slice(0, 9))}
          <details>
            <summary>{c.advanced}</summary>
            {fields((Object.keys(PARAMETER_RULES) as ParameterKey[]).slice(9))}
          </details>
        </section>
        <section
          className="study-results"
          aria-label={c.title}
          aria-busy={busy}
          data-testid="study-results"
          data-applied-capacity={applied.parameters.batteryMWh}
          data-original-capacity={original.parameters.batteryMWh}
        >
          <div className="study-result-head">
            <h3>{c.daily}</h3>
            <span>{t.scenarios[applied.id].name}</span>
          </div>
          {mode === 'free' && (
            <div
              className={`comparison-message ${comparison.status}`}
              data-testid="comparison-status"
            >
              <strong>{c.comparison[comparison.status]}</strong>
              <span>{comparison.comparableSavingsCny === null ? c.difference : c.savings}</span>
              <b data-testid="comparison-bill">
                {amounts(displayMoney(comparison.billDifferenceCny, lang))} {currencyCode(lang)}
              </b>
            </div>
          )}
          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>{c.capacity}</th>
                  <th>
                    {c.original}
                    <small>
                      {original.parameters.batteryMW} MW / {original.parameters.batteryMWh} MWh
                    </small>
                  </th>
                  <th>
                    {c.proposal}
                    <small>
                      {applied.parameters.batteryMW} MW / {applied.parameters.batteryMWh} MWh
                    </small>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map(([label, a, b, unit]) => (
                  <tr key={label}>
                    <th scope="row">
                      {label}
                      <small>{unit}</small>
                    </th>
                    <td>
                      {unit === 'MWh' ? a.toFixed(3) : amounts(a)}
                      {label === c.peak && (
                        <small data-testid="original-peak-time">
                          {timeLabel(comparison.originalPeak.minute)} ·{' '}
                          {t.tariffLong[comparison.originalPeak.band]}
                        </small>
                      )}
                    </td>
                    <td>
                      {unit === 'MWh' ? b.toFixed(3) : amounts(b)}
                      {label === c.peak && (
                        <small data-testid="proposal-peak-time">
                          {timeLabel(comparison.proposalPeak.minute)} ·{' '}
                          {t.tariffLong[comparison.proposalPeak.band]}
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="study-peak-note">{c.peakNote}</p>
          {comparison.hasUnserved && <p className="study-warning">{c.reliability}</p>}
          <div className="study-chart-tabs" role="group" aria-label={c.energy}>
            {(['energy', 'grid', 'unserved'] as const).map((kind) => (
              <button
                className="pill-btn"
                aria-pressed={chartKind === kind}
                key={kind}
                onClick={() => setChartKind(kind)}
              >
                {c[kind]}
              </button>
            ))}
          </div>
          <div
            className="study-chart"
            data-testid="comparison-chart"
            aria-label={`${c[chartKind]} (${power ? 'MW' : 'MWh'})`}
          >
            <ResponsiveContainer width="100%" height={260} minWidth={0}>
              <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e4eaf3" />
                <XAxis
                  dataKey="minute"
                  type="number"
                  domain={[0, 1440]}
                  ticks={[0, 360, 720, 1080, 1440]}
                  tickFormatter={timeLabel}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  width={52}
                  domain={[0, 'auto']}
                  unit={power ? ' MW' : ''}
                  tick={{ fontSize: 10 }}
                  label={{
                    value: power ? 'MW' : 'MWh',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: 10 },
                  }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const row = data[Number(label)]
                    if (!row) return null
                    return (
                      <div className="study-tooltip">
                        <strong>{timeLabel(Number(label))}</strong>
                        {[original, applied].map((day, i) => (
                          <div key={i}>
                            {i ? c.proposal : c.original}:{' '}
                            {Number(payload[i]?.value ?? 0).toFixed(2)} {power ? 'MW' : 'MWh'}
                            {!power && (
                              <small>
                                SOC {(i ? row.bSoc : row.aSoc)?.toFixed(1) ?? c.na}
                                {day.parameters.batteryMWh ? '%' : ''} · {day.parameters.batteryMWh}{' '}
                                MWh
                              </small>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  }}
                />
                <Legend />
                <Line
                  name={c.original}
                  dataKey={series[0]}
                  stroke="#889bb5"
                  strokeDasharray="5 4"
                  type={power ? 'stepAfter' : 'linear'}
                  dot={false}
                  isAnimationActive={false}
                  strokeWidth={2}
                />
                <Line
                  name={c.proposal}
                  dataKey={series[1]}
                  stroke="#326ef5"
                  type={power ? 'stepAfter' : 'linear'}
                  dot={false}
                  isAnimationActive={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <details className="study-configs">
            <summary>{c.energyAccounting}</summary>
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>MWh</th>
                  <th>{c.original}</th>
                  <th>{c.proposal}</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(5).map(([label, a, b]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td>{a.toFixed(3)}</td>
                    <td>{b.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <h4>{c.solver}</h4>
          <div className="study-solvers">
            {[original, applied].map((day, i) => (
              <div key={i}>
                <span>{i ? c.proposal : c.original}</span>
                <SolverSummary day={day} />
              </div>
            ))}
          </div>
          <details className="study-configs">
            <summary>
              {c.original} / {c.proposal} · {c.common}
            </summary>
            <table className="comparison-table">
              <tbody>
                {(Object.keys(PARAMETER_RULES) as ParameterKey[]).map((key) => (
                  <tr key={key}>
                    <th>
                      {c.labels[key]}
                      <small>{PARAMETER_RULES[key].unit}</small>
                    </th>
                    <td>{original.parameters[key]}</td>
                    <td>{applied.parameters[key]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <p className="study-performance">
            {c.timing}: {Math.round(result.computeMs)} / {Math.round(result.roundTripMs)} ms
          </p>
        </section>
      </div>
      <div className="study-notes">
        <p>{c.assumptions}</p>
        <p>
          {c.pricing} {c.limits}
        </p>
        <p>{c.geometry}</p>
      </div>
    </div>
  )
}
