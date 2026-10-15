import { useId, useState, type CSSProperties } from 'react'
import { Pause, Play } from 'lucide-react'
import { useI18n } from '../../i18n'
import { tankCopy } from '../../learning/copy'
import { tankModel, TANK_SCALE } from '../../learning/tank'
import './storage-tank.css'

type TankBase = {
  capacityMWh: number
  ratedMW: number
  socMinPct: number
  socMaxPct: number
  compareTo?: { capacityMWh: number; ratedMW: number }
  size?: 'sm' | 'md'
}
export type StorageTankProps = TankBase &
  (
    | { preview: true; storedMWh?: never; flowMW?: never }
    | { preview?: false; storedMWh: number; flowMW: number }
  )
export default function StorageTank(props: StorageTankProps) {
  const { lang } = useI18n()
  const c = tankCopy[lang]
  const [paused, setPaused] = useState(false)
  const id = useId().replace(/:/g, '')
  const m = tankModel({
    ...props,
    storedMWh: props.preview ? null : props.storedMWh,
    flowMW: props.preview ? 0 : props.flowMW,
  })
  const original = props.compareTo
    ? tankModel({ ...props, ...props.compareTo, storedMWh: null, flowMW: 0 })
    : null
  const x = 22,
    y = 34,
    h = 110,
    bottom = y + h,
    center = x + m.width / 2
  const pipe = (cx: number) => `M ${cx} ${bottom} V 177 H 308`
  const waterY = bottom - (m.level ?? 0) * h
  const animated = m.direction !== 'idle' && !props.preview
  const number = (n: number, digits = 1) =>
    n.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', { maximumFractionDigits: digits })
  const state = !m.exists
    ? c.noTank
    : !m.connected
      ? c.closed
      : props.preview
        ? c.preview
        : c[m.direction]
  return (
    <section
      className={`storage-tank storage-tank--${props.size ?? 'md'}`}
      data-testid={props.preview ? 'draft-tank' : 'snapshot-tank'}
      data-direction={m.direction}
      data-paused={paused}
      aria-label={c.title}
    >
      <div className="tank-heading">
        <strong>{c.title}</strong>
        {animated && (
          <button
            type="button"
            className="tank-pause"
            aria-label={paused ? c.resume : c.pause}
            aria-pressed={paused}
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
        )}
      </div>
      <p className="tank-caption">{props.preview ? c.previewLabel : c.liveLabel}</p>
      {(m.exists || original?.exists) && (
        <svg
          viewBox="0 0 340 207"
          role="img"
          aria-labelledby={`${id}-title ${id}-desc`}
          className={`tank-drawing ${animated ? 'tank-moving' : ''}`}
          style={{ '--tank-duration': `${m.animationSeconds}s` } as CSSProperties}
        >
          <title id={`${id}-title`}>
            {c.title}: {state}
          </title>
          <desc id={`${id}-desc`}>
            {c.explanation} {number(props.capacityMWh)} MWh, {number(props.ratedMW)} MW.{' '}
            {m.level !== null ? `${c.level}: ${number(m.level * 100)}%.` : c.noLevel}
          </desc>
          <defs>
            <clipPath id={`${id}-clip`}>
              <rect x={x + 1} y={y + 1} width={Math.max(0, m.width - 2)} height={h - 2} rx="6" />
            </clipPath>
            <linearGradient id={`${id}-water`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#29bbd0" stopOpacity="0.62" />
              <stop offset="100%" stopColor="#3978ee" stopOpacity="0.22" />
            </linearGradient>
            <pattern
              id={`${id}-hatch`}
              width="8"
              height="8"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(35)"
            >
              <line x1="0" y1="0" x2="0" y2="8" stroke="#bdd4e8" strokeWidth="2" />
            </pattern>
          </defs>
          {original?.exists && (
            <g className="tank-original">
              <path
                d={pipe(x + original.width / 2)}
                fill="none"
                strokeWidth={Math.max(2, original.pipeWidth + 2)}
              />
            </g>
          )}
          {m.exists && (
            <>
              <rect
                x={x}
                y={y}
                width={m.width}
                height={h}
                rx="7"
                className="tank-shell"
                data-testid="tank-outline"
              />
              <g clipPath={`url(#${id}-clip)`}>
                {props.preview ? (
                  <rect
                    x={x}
                    y={bottom - m.max * h}
                    width={m.width}
                    height={(m.max - m.min) * h}
                    fill={`url(#${id}-hatch)`}
                  />
                ) : (
                  <>
                    <rect
                      x={x}
                      y={waterY}
                      width={m.width}
                      height={(m.level ?? 0) * h}
                      fill={`url(#${id}-water)`}
                      className="tank-water"
                      data-testid="tank-water"
                      data-level={m.level}
                    />
                    {(m.level ?? 0) > 0 && (
                      <path
                        d={`M ${x - 48} ${waterY} Q ${x - 36} ${waterY - 3} ${x - 24} ${waterY} T ${x} ${waterY} T ${x + 24} ${waterY} T ${x + 48} ${waterY} T ${x + 72} ${waterY} T ${x + 96} ${waterY} T ${x + 120} ${waterY} T ${x + 144} ${waterY} T ${x + 168} ${waterY} T ${x + 192} ${waterY} T ${x + 216} ${waterY} T ${x + 240} ${waterY}`}
                        className="tank-surface"
                      />
                    )}
                  </>
                )}
              </g>
              {[m.min, m.max].map((bound, index) => (
                <g key={index} className="tank-bound">
                  <line
                    x1={x}
                    x2={x + m.width + 5}
                    y1={bottom - bound * h}
                    y2={bottom - bound * h}
                  />
                  <text x={x + m.width + 9} y={bottom - bound * h + 4}>
                    {number(bound * 100)}%
                  </text>
                </g>
              ))}
              <text x={x} y="19" className="tank-capacity">
                {number(props.capacityMWh)} MWh
              </text>
              <path
                d={pipe(center)}
                className="tank-pipe"
                strokeWidth={Math.max(3, m.pipeWidth + 4)}
                fill="none"
              />
              <path
                d={pipe(center)}
                className="tank-pipe-core"
                strokeWidth={Math.max(1, m.pipeWidth)}
                fill="none"
                data-testid="tank-pipe"
              />
              {m.connected && (
                <>
                  {animated && (
                    <path
                      d={pipe(center)}
                      pathLength="100"
                      className="tank-flow"
                      strokeWidth={Math.max(2, m.pipeWidth * 0.42)}
                      fill="none"
                    />
                  )}
                  <path
                    d={
                      m.direction === 'charging'
                        ? 'M 270 171 L 263 177 L 270 183'
                        : 'M 264 171 L 271 177 L 264 183'
                    }
                    className="tank-arrow"
                    data-testid="tank-arrow"
                    opacity={m.direction === 'idle' ? 0.45 : 1}
                  />
                  {(props.preview || m.direction === 'idle') && (
                    <path d="M 244 171 L 237 177 L 244 183" className="tank-arrow" opacity="0.45" />
                  )}
                </>
              )}
              {!m.connected && (
                <g className="tank-valve" data-testid="tank-valve">
                  <circle cx="264" cy="177" r="10" />
                  <path d="M 257 170 L 271 184" />
                </g>
              )}
              <text x="317" y="202" textAnchor="end">
                {number(props.ratedMW)} MW
              </text>
            </>
          )}
          {original?.exists && (
            <g className="tank-original">
              <rect
                x={x}
                y={y}
                width={original.width}
                height={h}
                rx="7"
                data-testid="tank-original-outline"
              />
            </g>
          )}
        </svg>
      )}
      <p className="tank-state" data-testid="tank-state">
        {state}
        {!props.preview && m.connected && ` · ${number(Math.abs(props.flowMW), 2)} MW`}
      </p>
      {m.exists && (
        <>
          {!props.preview && (
            <p className="tank-reading">
              {c.level}:{' '}
              <strong>
                {number(props.storedMWh, 2)} / {number(props.capacityMWh)} MWh
              </strong>{' '}
              · {number((m.level ?? 0) * 100)}%
            </p>
          )}
          <p className="tank-range">
            {c.range}: {number(m.usableMWh)} MWh · {number(props.socMinPct)}–
            {number(props.socMaxPct)}%
          </p>
          {m.durationHours !== null && (
            <p className="tank-equation">
              {number(props.capacityMWh)} MWh ÷ {number(props.ratedMW)} MW ={' '}
              <strong>
                {number(m.durationHours, 2)} {c.hours}
              </strong>
              <span>{c.nominal}</span>
            </p>
          )}
        </>
      )}
      {original && (
        <p className="tank-reference">
          <i aria-hidden="true" />
          {c.original}: {number(props.compareTo!.capacityMWh)} MWh /{' '}
          {number(props.compareTo!.ratedMW)} MW
        </p>
      )}
      <details className="tank-explanation">
        <summary>{c.how}</summary>
        <p>{c.explanation}</p>
        <p>{props.preview ? c.noLevel : c.snapshotNote}</p>
        <p>{c.limits}</p>
        <p>{c.scale(TANK_SCALE.capacityMWh, TANK_SCALE.ratedMW)}</p>
      </details>
    </section>
  )
}
