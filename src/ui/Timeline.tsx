import { memo, useMemo, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { ChevronDown, ChevronUp, Pause, Play, RotateCcw } from 'lucide-react'
import { CONFIG, TARIFF_PERIODS, timeLabel } from '../domain/config'
import type { SimulationDay, StrategyCode } from '../domain/types'
import { useI18n } from '../i18n'
import { TONE } from './format'

type SeriesKey = 'renewable' | 'demand' | 'grid' | 'battery' | 'soc'
const C = {
  renewable: '#22b07d',
  demand: '#94a3b8',
  grid: '#3d74f6',
  discharge: '#f59e0b',
  charge: '#0fb3cf',
  soc: '#8b5cf6',
}
const SERIES: { key: SeriesKey; color: string }[] = [
  { key: 'renewable', color: C.renewable },
  { key: 'demand', color: C.demand },
  { key: 'grid', color: C.grid },
  { key: 'battery', color: C.discharge },
  { key: 'soc', color: C.soc },
]
const STRATEGY_TONE: Record<StrategyCode, string> = {
  'hard-shave': '#ef6b4a',
  absorb: TONE.renewable,
  'export-surplus': '#86d7b5',
  'valley-charge': TONE.charge,
  'flat-charge': '#7dd3e6',
  'peak-discharge': TONE.discharge,
  'hold-reserve': '#cbd5e1',
  standby: 'transparent',
}
const AXIS_W = 36
function powerBounds(day: SimulationDay, baseline: SimulationDay): [number, number] {
  let min = -12,
    max = Math.max(20, day.parameters.gridImportMW)
  for (const d of [day, baseline])
    for (const f of d.frames) {
      const m = f.metrics
      min = Math.min(min, -m.gridExportMW, -m.batteryChargeMW)
      max = Math.max(max, m.renewableMW, m.demandMW, m.gridImportMW, m.batteryDischargeMW)
    }
  return [Math.floor(min / 5) * 5, Math.ceil(max / 5) * 5]
}
const TOP = 8

/** Keep all minute boundaries: power is constant within each minute, SOC is continuous.
 * Memoised per day/visibility so playback does not rebuild SVG paths. */
const Chart = memo(function Chart({
  day,
  baseline,
  hidden,
  importCapLabel,
  bounds,
}: {
  day: SimulationDay
  baseline: SimulationDay
  hidden: SeriesKey[]
  bounds: [number, number]
  importCapLabel: string
}) {
  const data = useMemo(
    () =>
      day.frames.map((f) => {
        const battery = f.metrics.batteryDischargeMW - f.metrics.batteryChargeMW
        const b = baseline.frames[f.minute].metrics
        return {
          minute: f.minute,
          renewable: f.metrics.renewableMW,
          demand: f.metrics.demandMW,
          grid: f.metrics.gridImportMW - f.metrics.gridExportMW,
          discharge: Math.max(0, battery),
          charge: Math.min(0, battery),
          soc: day.parameters.batteryMWh ? f.metrics.socPct : null,
          baseGrid: b.gridImportMW - b.gridExportMW,
          baseSoc: baseline.parameters.batteryMWh ? b.socPct : null,
        }
      }),
    [day, baseline],
  )
  const fault = day.id === 'fault'
  const show = (k: SeriesKey) => !hidden.includes(k)
  const axisTick = { fontSize: 10, fill: '#9aa7b8' }
  const common = {
    dot: false,
    activeDot: false,
    isAnimationActive: false,
    type: 'stepAfter' as const,
  }
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <ComposedChart data={data} margin={{ top: TOP, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="g-renew" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.renewable} stopOpacity={0.32} />
            <stop offset="100%" stopColor={C.renewable} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="g-dis" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.discharge} stopOpacity={0.55} />
            <stop offset="100%" stopColor={C.discharge} stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="g-chg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.charge} stopOpacity={0.05} />
            <stop offset="100%" stopColor={C.charge} stopOpacity={0.5} />
          </linearGradient>
          <linearGradient id="g-peak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.1} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.01} />
          </linearGradient>
          <linearGradient id="g-valley" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0fb3cf" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#0fb3cf" stopOpacity={0.01} />
          </linearGradient>
          <filter id="glow" x="-5%" y="-50%" width="110%" height="200%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <CartesianGrid vertical={false} stroke="#e6ebf1" strokeDasharray="2 6" />
        <XAxis dataKey="minute" type="number" domain={[0, 1440]} hide />
        <YAxis
          yAxisId="p"
          domain={bounds}
          width={AXIS_W}
          tickLine={false}
          axisLine={false}
          tick={axisTick}
        />
        <YAxis
          yAxisId="s"
          orientation="right"
          domain={[0, 100]}
          ticks={[0, 50, 100]}
          tickFormatter={(v) => `${v}%`}
          width={AXIS_W}
          tickLine={false}
          axisLine={false}
          tick={axisTick}
        />
        {TARIFF_PERIODS.filter((p) => p.band !== 'flat').map((p) => (
          <ReferenceArea
            key={p.start}
            yAxisId="p"
            x1={p.start}
            x2={p.end}
            fill={`url(#g-${p.band === 'peak' ? 'peak' : 'valley'})`}
            strokeOpacity={0}
          />
        ))}
        <ReferenceLine yAxisId="p" y={0} stroke="#cfd8e3" />
        <ReferenceLine
          yAxisId="p"
          y={day.parameters.gridImportMW}
          stroke="#c3cdd8"
          strokeDasharray="4 4"
          label={{
            value: importCapLabel,
            position: 'insideTopRight',
            fontSize: 9,
            fill: '#9aa7b8',
          }}
        />
        {fault && (
          <ReferenceLine
            yAxisId="p"
            x={CONFIG.faultMinute}
            stroke={TONE.alarm}
            strokeDasharray="3 3"
            strokeOpacity={0.7}
          />
        )}
        {show('renewable') && (
          <Area
            {...common}
            yAxisId="p"
            dataKey="renewable"
            stroke={C.renewable}
            strokeWidth={1.8}
            fill="url(#g-renew)"
          />
        )}
        {show('battery') && (
          <Area
            {...common}
            yAxisId="p"
            dataKey="discharge"
            stroke={C.discharge}
            strokeWidth={1.4}
            fill="url(#g-dis)"
            baseValue={0}
          />
        )}
        {show('battery') && (
          <Area
            {...common}
            yAxisId="p"
            dataKey="charge"
            stroke={C.charge}
            strokeWidth={1.4}
            fill="url(#g-chg)"
            baseValue={0}
          />
        )}
        {show('demand') && (
          <Line {...common} yAxisId="p" dataKey="demand" stroke={C.demand} strokeWidth={1.4} />
        )}
        {fault && show('grid') && (
          <Line
            {...common}
            yAxisId="p"
            dataKey="baseGrid"
            stroke={C.grid}
            strokeDasharray="3 4"
            strokeWidth={1.2}
            strokeOpacity={0.5}
          />
        )}
        {show('grid') && (
          <Line
            {...common}
            yAxisId="p"
            dataKey="grid"
            stroke={C.grid}
            strokeWidth={2}
            filter="url(#glow)"
          />
        )}
        {fault && show('soc') && (
          <Line
            {...common}
            yAxisId="s"
            type="linear"
            dataKey="baseSoc"
            stroke={C.soc}
            strokeDasharray="3 4"
            strokeWidth={1.2}
            strokeOpacity={0.5}
          />
        )}
        {show('soc') && (
          <Line
            {...common}
            yAxisId="s"
            type="linear"
            dataKey="soc"
            stroke={C.soc}
            strokeWidth={2}
            filter="url(#glow)"
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
})

/** Vertical position (as a fraction of the plot height) of a value on either axis. */

export function Timeline({
  day,
  baseline,
  minute,
  playing,
  setPlaying,
  onSeek,
  speed,
  setSpeed,
  story,
}: {
  story: { key: string; title: string; text: string; tone: string }
  day: SimulationDay
  baseline: SimulationDay
  minute: number
  playing: boolean
  setPlaying: (v: boolean) => void
  onSeek: (m: number) => void
  speed: number
  setSpeed: (v: number) => void
}) {
  const { t } = useI18n()
  const bounds = useMemo(() => powerBounds(day, baseline), [day, baseline])
  const yFrac = (v: number, axis: 'p' | 's') =>
    axis === 'p' ? (bounds[1] - v) / (bounds[1] - bounds[0]) : (100 - v) / 100
  const [hidden, setHidden] = useState<SeriesKey[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const segments = useMemo(() => {
    const out: { start: number; end: number; code: StrategyCode }[] = []
    for (const f of day.frames) {
      const last = out[out.length - 1]
      if (last && last.code === f.strategy.code) last.end = f.minute + 1
      else out.push({ start: f.minute, end: f.minute + 1, code: f.strategy.code })
    }
    return out
  }, [day])
  const bookmarks: [string, number][] = [
    [t.timeline.bookmarks.night, 30],
    [t.timeline.bookmarks.noon, 720],
    ...(day.id === 'fault'
      ? ([[t.timeline.bookmarks.fault, CONFIG.faultMinute]] as [string, number][])
      : []),
    [t.timeline.bookmarks.peak, 1140],
  ]
  const f = minute / 1440
  const now = day.frames[Math.min(1439, Math.max(0, minute))].metrics
  const battery = now.batteryDischargeMW - now.batteryChargeMW
  const readout: Record<SeriesKey, string> = {
    renewable: now.renewableMW.toFixed(1),
    demand: now.demandMW.toFixed(1),
    grid: (now.gridImportMW - now.gridExportMW).toFixed(1),
    battery: battery.toFixed(1),
    soc: day.parameters.batteryMWh ? `${now.socPct.toFixed(0)}%` : t.study.na,
  }
  const dots: { id: string; key: SeriesKey; y: number; color: string }[] = [
    { id: 'r', key: 'renewable', y: yFrac(now.renewableMW, 'p'), color: C.renewable },
    { id: 'd', key: 'demand', y: yFrac(now.demandMW, 'p'), color: C.demand },
    { id: 'g', key: 'grid', y: yFrac(now.gridImportMW - now.gridExportMW, 'p'), color: C.grid },
    {
      id: 'b',
      key: 'battery',
      y: yFrac(battery, 'p'),
      color: battery >= 0 ? C.discharge : C.charge,
    },
    { id: 's', key: 'soc', y: yFrac(now.socPct, 's'), color: C.soc },
  ]
  const labels: Record<SeriesKey, string> = {
    renewable: t.timeline.renewable,
    demand: t.timeline.load,
    grid: t.timeline.grid,
    battery: t.timeline.battery,
    soc: t.timeline.soc,
  }
  return (
    <section
      className={`card timeline${collapsed ? ' is-collapsed' : ''}`}
      aria-label={t.timeline.title}
    >
      <div className="tl-head">
        <button
          className="play-btn"
          aria-label={playing ? t.timeline.pause : t.timeline.play}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? (
            <Pause size={16} fill="currentColor" />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
        </button>
        <button
          className="icon-btn"
          aria-label={t.timeline.restart}
          title={t.timeline.restart}
          onClick={() => onSeek(0)}
        >
          <RotateCcw size={15} />
        </button>
        <strong className="tl-time" data-testid="timeline-time">
          {timeLabel(minute)}
        </strong>
        <div className="seg" role="group" aria-label={t.timeline.speed}>
          {[10, 30, 60].map((s) => (
            <button key={s} className={s === speed ? 'is-active' : ''} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
        <div
          className="story"
          key={story.key}
          aria-live="polite"
          style={{ ['--tone' as string]: story.tone }}
        >
          <span className="story-dot" />
          <strong>{story.title}</strong>
          <span className="story-text">{story.text}</span>
        </div>
        <div className="bookmarks">
          {bookmarks.map(([label, m]) => (
            <button
              key={label}
              className={label === t.timeline.bookmarks.fault ? 'is-alert' : ''}
              onClick={() => onSeek(m)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="icon-btn"
          aria-label={t.timeline.chart}
          title={t.timeline.chart}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="legend">
            {SERIES.map((s) => (
              <button
                key={s.key}
                aria-pressed={!hidden.includes(s.key)}
                className={hidden.includes(s.key) ? 'is-off' : ''}
                onClick={() =>
                  setHidden((h) =>
                    h.includes(s.key) ? h.filter((k) => k !== s.key) : [...h, s.key],
                  )
                }
              >
                {s.key === 'battery' ? (
                  <i className="split" />
                ) : (
                  <i style={{ background: s.color }} />
                )}
                {labels[s.key]}
                <b>{readout[s.key]}</b>
              </button>
            ))}
            {day.id === 'fault' && <span className="legend-note">┄ {t.timeline.baseline}</span>}
            <span className="legend-units">MW · SOC %</span>
          </div>
          <div
            className="chart"
            data-testid="trend-chart"
            onPointerDown={(event) => {
              if (!event.isPrimary || event.button !== 0) return
              // Pointer coordinates retain subpixel precision and also support touch.
              const rect = event.currentTarget.getBoundingClientRect()
              const x = event.clientX - rect.left - AXIS_W
              const width = rect.width - 2 * AXIS_W
              // Ignore axis gutters; the existing range input provides keyboard access.
              if (width <= 0 || x < 0 || x > width || event.clientY < rect.top + TOP) return
              onSeek(Math.min(1439, Math.max(0, Math.round((x / width) * 1440))))
            }}
          >
            <Chart
              day={day}
              baseline={baseline}
              hidden={hidden}
              importCapLabel={`${t.timeline.importCap} ${day.parameters.gridImportMW} MW`}
              bounds={bounds}
            />
            <div
              className="plot"
              style={{ ['--axis' as string]: `${AXIS_W}px`, ['--top' as string]: `${TOP}px` }}
            >
              <span className="cursor" style={{ left: `${f * 100}%` }}>
                {dots
                  .filter(
                    (d) =>
                      !hidden.includes(d.key) && (d.key !== 'soc' || day.parameters.batteryMWh > 0),
                  )
                  .map((d) => (
                    <i
                      key={d.id}
                      style={{
                        top: `${Math.min(1, Math.max(0, d.y)) * 100}%`,
                        background: d.color,
                      }}
                    />
                  ))}
              </span>
            </div>
          </div>
        </>
      )}

      <div className="scrubber" style={{ ['--axis' as string]: `${AXIS_W}px` }}>
        <div className="tracks">
          <div className="tariff" title={t.timeline.tariffNote}>
            {TARIFF_PERIODS.map((p) => (
              <span
                key={p.start}
                className={p.band}
                style={{
                  left: `${(p.start / 1440) * 100}%`,
                  width: `${((p.end - p.start) / 1440) * 100}%`,
                }}
              >
                {t.tariff[p.band]}
              </span>
            ))}
          </div>
          <div className="ribbon">
            {segments.map((s) => (
              <span
                key={s.start}
                title={`${timeLabel(s.start)}–${timeLabel(s.end)} ${t.strategy[s.code]}`}
                style={{
                  left: `${(s.start / 1440) * 100}%`,
                  width: `${((s.end - s.start) / 1440) * 100}%`,
                  background: STRATEGY_TONE[s.code],
                }}
              />
            ))}
          </div>
          <div className="progress" style={{ width: `${f * 100}%` }} />
          <input
            aria-label={t.timeline.title}
            type="range"
            min={0}
            max={1439}
            step={1}
            value={minute}
            onChange={(e) => onSeek(Number(e.target.value))}
          />
        </div>
        <div className="ticks">
          {['00:00', '06:00', '12:00', '18:00', '24:00'].map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
      </div>
    </section>
  )
}
