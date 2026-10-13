import { Bell, Cloud, Info, Pause, Sparkles, Sun, TriangleAlert, Zap } from 'lucide-react'
import { timeLabel } from '../domain/config'
import type { ScenarioId, Snapshot } from '../domain/types'
import { useI18n } from '../i18n'

const ICONS = { sunny: Sun, cloudy: Cloud, fault: TriangleAlert } as const

export function TopBar({
  scenario,
  setScenario,
  snapshot,
  touring,
  toggleTour,
  onAlarms,
  onAbout,
}: {
  scenario: ScenarioId
  setScenario: (id: ScenarioId) => void
  snapshot: Snapshot
  touring: boolean
  toggleTour: () => void
  onAlarms: () => void
  onAbout: () => void
}) {
  const { t, lang, setLang } = useI18n()
  const alarmCount = snapshot.alarms.length
  const critical = snapshot.alarms.some((a) => a.severity === 'critical')
  return (
    <header className="topbar">
      <div className="card brand">
        <span className="brand-mark">
          <Zap size={18} fill="currentColor" />
        </span>
        <span className="brand-text">
          <strong>BESS Twin</strong>
          <small>{t.brandSub}</small>
        </span>
      </div>

      <nav className="card scenario-switch" aria-label={t.scenarios[scenario].name}>
        {(Object.keys(ICONS) as ScenarioId[]).map((id) => {
          const Icon = ICONS[id]
          return (
            <button
              key={id}
              className={id === scenario ? 'is-active' : ''}
              aria-pressed={id === scenario}
              onClick={() => setScenario(id)}
              title={t.scenarios[id].hint}
            >
              <Icon size={15} />
              <span>{t.scenarios[id].name}</span>
            </button>
          )
        })}
      </nav>

      <div className="topbar-right">
        <div className="card site-chip">
          <span className="site-code">S-01</span>
          <span className="site-text">
            <strong>{t.site}</strong>
            <small>{t.scenarios[scenario].hint}</small>
          </span>
        </div>
        <div className="card live-chip" data-testid="sim-clock">
          <span className="pulse-dot" />
          <span>{t.simBadge}</span>
          <strong>{timeLabel(snapshot.minute)}</strong>
        </div>
        <button
          className={`card pill-btn tour-btn${touring ? ' is-on' : ''}`}
          aria-label={touring ? t.tour.stop : t.tour.start}
          onClick={toggleTour}
        >
          {touring ? <Pause size={14} /> : <Sparkles size={14} />}
          <span>{touring ? t.tour.stop : t.tour.start}</span>
        </button>
        <div className="card icon-group">
          <button
            className="icon-btn lang-btn"
            aria-label={t.langSwitchLabel}
            title={t.langSwitchLabel}
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          >
            {t.langSwitch}
          </button>
          <button className="icon-btn" aria-label={t.about} title={t.about} onClick={onAbout}>
            <Info size={17} />
          </button>
          <button
            className={`icon-btn bell${alarmCount ? (critical ? ' is-critical' : ' is-warning') : ''}`}
            data-tour="alarms"
            aria-label={t.alarms.title}
            title={t.alarms.title}
            onClick={onAlarms}
          >
            <Bell size={17} />
            {alarmCount > 0 && <i>{alarmCount}</i>}
          </button>
        </div>
      </div>
    </header>
  )
}
