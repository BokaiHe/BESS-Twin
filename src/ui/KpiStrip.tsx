import {
  ArrowDownLeft,
  ArrowUpRight,
  BatteryCharging,
  Building2,
  Leaf,
  PiggyBank,
  Zap,
} from 'lucide-react'
import type { Snapshot } from '../domain/types'
import { useI18n } from '../i18n'
import {
  TONE,
  clusterMode,
  currencySymbol,
  modeText,
  modeTone,
  money,
  mw,
  priceText,
} from './format'

export function KpiStrip({ snapshot, onSavings }: { snapshot: Snapshot; onSavings: () => void }) {
  const { t, lang } = useI18n()
  const m = snapshot.metrics
  const mode = clusterMode(snapshot)
  const importing = m.gridImportMW > 0.01
  const exporting = m.gridExportMW > 0.01
  const savings = m.estimatedSavingsCny
  return (
    <section className="kpi-strip" aria-label="KPI">
      <article className="card kpi" style={{ ['--tone' as string]: TONE.renewable }}>
        <span className="kpi-icon">
          <Leaf size={18} />
        </span>
        <div>
          <span className="kpi-label">{t.kpi.renewable}</span>
          <strong data-testid="kpi-renewable">
            {mw(m.renewableMW)}
            <small>MW</small>
          </strong>
          <span className="kpi-sub">
            {t.kpi.pv} {mw(m.pvMW)} · {t.kpi.wind} {mw(m.windMW)}
          </span>
        </div>
      </article>

      <article className="card kpi" style={{ ['--tone' as string]: TONE.grid }}>
        <span className="kpi-icon">
          <Building2 size={18} />
        </span>
        <div>
          <span className="kpi-label">{t.kpi.load}</span>
          <strong>
            {mw(m.demandMW)}
            <small>MW</small>
          </strong>
          <span className={`kpi-sub${m.unservedMW > 0.001 ? ' is-alert' : ''}`}>
            {m.unservedMW > 0.001 ? `${t.kpi.shortfall} ${mw(m.unservedMW, 2)} MW` : t.kpi.balanced}
          </span>
        </div>
      </article>

      <article className="card kpi" style={{ ['--tone' as string]: modeTone(mode) }}>
        <span className="kpi-icon">
          <BatteryCharging size={18} />
        </span>
        <div>
          <span className="kpi-label">{t.kpi.storage}</span>
          <strong data-testid="kpi-soc">
            {snapshot.parameters.batteryMWh ? m.socPct.toFixed(1) : t.study.na}
            {snapshot.parameters.batteryMWh > 0 && <small>%</small>}
          </strong>
          <span className="kpi-sub tone">
            {modeText(t, mode)}
            {mode !== 'idle' && ` ${mw(m.batteryChargeMW + m.batteryDischargeMW)} MW`}
          </span>
        </div>
      </article>

      <article className="card kpi" style={{ ['--tone' as string]: TONE.grid }}>
        <span className="kpi-icon">
          <Zap size={18} />
        </span>
        <div>
          <span className="kpi-label">{t.kpi.grid}</span>
          <strong>
            {mw(m.gridImportMW + m.gridExportMW)}
            <small>MW</small>
          </strong>
          <span className="kpi-sub">
            {importing ? (
              <>
                <ArrowDownLeft size={12} /> {t.flow.import}
              </>
            ) : exporting ? (
              <>
                <ArrowUpRight size={12} /> {t.flow.export}
              </>
            ) : (
              t.flow.none
            )}
            <span className={`band-tag ${snapshot.tariff.band}`}>
              {t.tariff[snapshot.tariff.band]}
            </span>
            {priceText(snapshot.tariff.importCnyPerKWh, lang)}
          </span>
        </div>
      </article>

      <button
        className="card kpi kpi-savings"
        style={{ ['--tone' as string]: TONE.renewable }}
        onClick={onSavings}
      >
        <span className="kpi-icon">
          <PiggyBank size={18} />
        </span>
        <div>
          <span className="kpi-label">{t.savings.title}</span>
          <strong data-testid="kpi-savings">
            {savings === null ? (
              <em>{t.savings.infeasible}</em>
            ) : (
              <>
                {savings < 0 && '-'}
                <small>{currencySymbol(lang)}</small>
                {money(Math.abs(savings), lang)}
              </>
            )}
          </strong>
          <span className="kpi-sub">
            {savings !== null && m.storedDeltaMWh > 0.05
              ? t.savings.stored(m.storedDeltaMWh.toFixed(1))
              : t.savings.sub}
          </span>
        </div>
      </button>
    </section>
  )
}
