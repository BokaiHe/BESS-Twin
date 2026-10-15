import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, TriangleAlert } from 'lucide-react'
import { timeLabel } from '../domain/config'
import type { SimulationDay } from '../domain/types'
import { useI18n } from '../i18n'
import { savingsBreakdown } from '../simulation/savings'
import { moneyText, priceText } from './format'

interface Item {
  key: string
  label: string
  formula: string
  valueCny: number
}

/** Visual ledger: two bills side by side, then where the difference comes from. */
export function SavingsPanel({ day, minute }: { day: SimulationDay; minute: number }) {
  const { t, lang } = useI18n()
  const [scope, setScope] = useState<'day' | 'now'>('day')
  const end = scope === 'day' ? day.frames.length : minute
  const b = useMemo(() => savingsBreakdown(day, end), [day, end])
  const savings = b.billDifferenceCny
  const comparable = b.estimatedSavingsCny !== null
  const totalLabel = comparable ? t.savings.net : t.savings.billDifference
  const bandName = (band: 'valley' | 'flat' | 'peak') => t.tariff[band]

  const items: Item[] = []
  for (const x of b.bands) {
    const d = x.baseImportMWh - x.caseImportMWh
    if (Math.abs(d) < 0.05) continue
    items.push({
      key: `imp-${x.band}`,
      label: d > 0 ? t.savings.lessBuy(bandName(x.band)) : t.savings.moreBuy(bandName(x.band)),
      formula: `${Math.abs(d).toFixed(1)} MWh × ${priceText(x.importPrice, lang)}`,
      valueCny: d * x.importPrice * 1000,
    })
  }
  const exportPrice = b.bands[0]?.exportPrice ?? 0
  const dExport = b.bands.reduce((s, x) => s + x.baseExportMWh - x.caseExportMWh, 0)
  if (Math.abs(dExport) >= 0.05)
    items.push({
      key: 'exp',
      label: dExport > 0 ? t.savings.lessSell : t.savings.moreSell,
      formula: `${Math.abs(dExport).toFixed(1)} MWh × ${priceText(exportPrice, lang)}`,
      valueCny: -dExport * exportPrice * 1000,
    })
  items.sort((a, c) => c.valueCny - a.valueCny)
  const scale = Math.max(1, ...items.map((i) => Math.abs(i.valueCny)), Math.abs(savings))
  const billMax = Math.max(1, b.baseCostCny, b.caseCostCny)

  return (
    <div className="savings">
      <div className="seg savings-scope" role="group">
        <button className={scope === 'day' ? 'is-active' : ''} onClick={() => setScope('day')}>
          {t.savings.scopeDay}
        </button>
        <button className={scope === 'now' ? 'is-active' : ''} onClick={() => setScope('now')}>
          {t.savings.scopeNow} {timeLabel(minute)}
        </button>
      </div>

      <div className="bills">
        {[
          { label: t.savings.baseline, v: b.baseCostCny, cls: 'base' },
          { label: t.savings.current, v: b.caseCostCny, cls: 'case' },
        ].map((r) => (
          <div className={`bill ${r.cls}`} key={r.cls}>
            <span>{r.label}</span>
            <div className="bill-bar">
              <i style={{ width: `${(Math.max(0, r.v) / billMax) * 100}%` }} />
            </div>
            <strong>{moneyText(r.v, lang)}</strong>
          </div>
        ))}
        <div className={`saved${!comparable ? ' is-incomparable' : savings < 0 ? ' is-neg' : ''}`}>
          {savings >= 0 ? <ArrowDown size={15} /> : <ArrowUp size={15} />}
          <span>{totalLabel}</span>
          <strong data-testid="savings-net">{moneyText(savings, lang)}</strong>
          {comparable && b.baseCostCny > 0 && (
            <em data-testid="savings-rate">{((savings / b.baseCostCny) * 100).toFixed(1)}%</em>
          )}
        </div>
      </div>

      {!comparable && (
        <p className="savings-warn">
          <TriangleAlert size={14} />
          {b.baselineUnservedMWh > 1e-9
            ? t.savings.gapNote(b.baselineUnservedMWh.toFixed(2))
            : day.diagnostics.solver.status === 'not-converged'
              ? t.study.comparison['not-converged']
              : t.study.comparison['different-supply']}
        </p>
      )}

      {day.id === 'fault' && (
        <p className="savings-warn" data-testid="fault-energy-note">
          {t.savings.faultEnergy(
            `${b.storedDeltaMWh >= 0 ? '+' : ''}${b.storedDeltaMWh.toFixed(2)}`,
            b.offlineStoredMWh.toFixed(2),
          )}
        </p>
      )}

      <h3 className="savings-h">{comparable ? t.savings.whereFrom : t.savings.differenceFrom}</h3>
      <div className="ledger">
        {items.map((i) => {
          const w = (Math.abs(i.valueCny) / scale) * 50
          return (
            <div className="ledger-row" key={i.key}>
              <div className="ledger-text">
                <span>{i.label}</span>
                <small>{i.formula}</small>
              </div>
              <div className="ledger-bar">
                <span className="axis" />
                <i
                  className={i.valueCny >= 0 ? 'pos' : 'neg'}
                  style={
                    i.valueCny >= 0
                      ? { left: '50%', width: `${w}%` }
                      : { right: '50%', width: `${w}%` }
                  }
                />
              </div>
              <strong className={i.valueCny >= 0 ? 'pos' : 'neg'}>
                {i.valueCny >= 0 ? '+' : ''}
                {moneyText(i.valueCny, lang)}
              </strong>
            </div>
          )
        })}
        <div className="ledger-row is-total">
          <div className="ledger-text">
            <span>{totalLabel}</span>
          </div>
          <div className="ledger-bar">
            <span className="axis" />
            <i
              className={savings >= 0 ? 'pos' : 'neg'}
              style={
                savings >= 0
                  ? { left: '50%', width: `${(Math.abs(savings) / scale) * 50}%` }
                  : { right: '50%', width: `${(Math.abs(savings) / scale) * 50}%` }
              }
            />
          </div>
          <strong className={savings >= 0 ? 'pos' : 'neg'}>{moneyText(savings, lang)}</strong>
        </div>
      </div>

      <details className="savings-notes">
        <summary>{t.savings.howTo}</summary>
        <ul>
          {t.savings.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </details>
    </div>
  )
}
