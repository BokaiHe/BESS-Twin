import type { SimulationDay, Snapshot } from '../domain/types'

export type SourceKey = 'pv' | 'wind' | 'gridImport' | 'batteryDischarge'
export type SinkKey = 'load' | 'batteryCharge' | 'gridExport'
export const FLOW_SOURCES: SourceKey[] = ['pv', 'wind', 'gridImport', 'batteryDischarge']
export const FLOW_SINKS: SinkKey[] = ['load', 'batteryCharge', 'gridExport']
const EPS = 1e-6 // MW, per-minute balance tolerance; not a display cutoff.
export interface EnergyFlows {
  sources: Record<SourceKey, number>
  sinks: Record<SinkKey, number>
  flows: { from: SourceKey; to: SinkKey; mwh: number }[]
  lost: { curtailed: number; clipping: number; unserved: number }
  storage: { initialMWh: number; finalMWh: number; deltaMWh: number; lossMWh: number }
  diagnostics: { maxBalanceErrorMW: number; batteryExportMWh: number }
}

/** Accounting attribution, not electron tracing. All values here are AC powers.
 * 1. Actual PV/wind (after curtailment) supply SERVED load, then battery charging.
 * 2. Battery discharge supplies the remaining load; grid imports fill remaining load
 *    and charging. PV/wind shares are proportional to their actual production.
 * 3. Remaining sources supply exports in proportion to their residual powers.
 *    Battery exports are unexpected with today's dispatch and explicitly reported.
 * No clipping, curtailment or unserved demand is inserted into the power balance.
 */
function allocateMinute(m: Snapshot['metrics']) {
  const values = [
    m.pvMW,
    m.windMW,
    m.gridImportMW,
    m.batteryDischargeMW,
    m.servedMW,
    m.batteryChargeMW,
    m.gridExportMW,
    m.curtailedMW,
    m.pvClippingMW,
    m.unservedMW,
  ]
  if (values.some((v) => !Number.isFinite(v) || v < 0)) throw new Error('Invalid flow power')
  const renewable = m.pvMW + m.windMW
  const residual =
    renewable +
    m.gridImportMW +
    m.batteryDischargeMW -
    m.servedMW -
    m.batteryChargeMW -
    m.gridExportMW
  if (Math.abs(residual) > EPS) throw new Error('Energy flow power imbalance')
  const edges: { from: SourceKey; to: SinkKey; mw: number }[] = []
  const add = (from: SourceKey, to: SinkKey, mw: number) => {
    if (mw > 0) edges.push({ from, to, mw })
  }
  const addRenewable = (to: SinkKey, mw: number) => {
    if (!renewable || !mw) return
    add('pv', to, (mw * m.pvMW) / renewable)
    add('wind', to, (mw * m.windMW) / renewable)
  }
  const renewLoad = Math.min(renewable, m.servedMW)
  const renewCharge = Math.min(renewable - renewLoad, m.batteryChargeMW)
  addRenewable('load', renewLoad)
  addRenewable('batteryCharge', renewCharge)
  const dischargeLoad = Math.min(m.batteryDischargeMW, m.servedMW - renewLoad)
  add('batteryDischarge', 'load', dischargeLoad)
  const gridLoad = Math.min(m.gridImportMW, Math.max(0, m.servedMW - renewLoad - dischargeLoad))
  const gridCharge = Math.min(m.gridImportMW - gridLoad, m.batteryChargeMW - renewCharge)
  add('gridImport', 'load', gridLoad)
  add('gridImport', 'batteryCharge', gridCharge)
  if (
    m.servedMW - renewLoad - dischargeLoad - gridLoad > EPS ||
    m.batteryChargeMW - renewCharge - gridCharge > EPS
  )
    throw new Error('Unsupported flow allocation: discharge cannot charge storage')
  const r = Math.max(0, renewable - renewLoad - renewCharge)
  const d = Math.max(0, m.batteryDischargeMW - dischargeLoad)
  const g = Math.max(0, m.gridImportMW - gridLoad - gridCharge)
  const surplus = r + d + g
  if (surplus > 0 && m.gridExportMW > 0) {
    addRenewable('gridExport', (m.gridExportMW * r) / surplus)
    add('batteryDischarge', 'gridExport', (m.gridExportMW * d) / surplus)
    add('gridImport', 'gridExport', (m.gridExportMW * g) / surplus)
  }
  return { edges, error: Math.abs(residual) }
}

/** Half-open minute window [startMinute, endMinute); 1440 uses the integrated summary.
 * Storage loss = AC charge − AC discharge − DC inventory change, including offline
 * inventory. A partial day or a fault day must never be assumed inventory-neutral.
 */
export function energyFlows(
  day: SimulationDay,
  startMinute: number,
  endMinute: number,
): EnergyFlows {
  if (
    !Number.isInteger(startMinute) ||
    !Number.isInteger(endMinute) ||
    startMinute < 0 ||
    endMinute > day.frames.length ||
    startMinute > endMinute
  )
    throw new RangeError('Invalid energy flow minute window')
  const sources: EnergyFlows['sources'] = { pv: 0, wind: 0, gridImport: 0, batteryDischarge: 0 }
  const sinks: EnergyFlows['sinks'] = { load: 0, batteryCharge: 0, gridExport: 0 }
  const lost = { curtailed: 0, clipping: 0, unserved: 0 }
  const flows = new Map<string, EnergyFlows['flows'][number]>()
  let maxBalanceErrorMW = 0
  for (let i = startMinute; i < endMinute; i++) {
    const m = day.frames[i].metrics
    const minute = allocateMinute(m)
    maxBalanceErrorMW = Math.max(maxBalanceErrorMW, minute.error)
    sources.pv += m.pvMW / 60
    sources.wind += m.windMW / 60
    sources.gridImport += m.gridImportMW / 60
    sources.batteryDischarge += m.batteryDischargeMW / 60
    sinks.load += m.servedMW / 60
    sinks.batteryCharge += m.batteryChargeMW / 60
    sinks.gridExport += m.gridExportMW / 60
    lost.curtailed += m.curtailedMW / 60
    lost.clipping += m.pvClippingMW / 60
    lost.unserved += m.unservedMW / 60
    for (const edge of minute.edges) {
      const key = `${edge.from}-${edge.to}`
      const existing = flows.get(key) ?? { from: edge.from, to: edge.to, mwh: 0 }
      existing.mwh += edge.mw / 60
      flows.set(key, existing)
    }
  }
  const storedAt = (minute: number) =>
    minute === day.frames.length ? day.summary.finalStoredMWh : day.frames[minute].metrics.storedMWh
  const initialMWh = storedAt(startMinute),
    finalMWh = storedAt(endMinute),
    deltaMWh = finalMWh - initialMWh
  const loss = sinks.batteryCharge - sources.batteryDischarge - deltaMWh
  if (!Number.isFinite(loss) || loss < -1e-6) throw new Error('Invalid storage energy accounting')
  return {
    sources,
    sinks,
    flows: [...flows.values()],
    lost,
    storage: { initialMWh, finalMWh, deltaMWh, lossMWh: Math.max(0, loss) },
    diagnostics: {
      maxBalanceErrorMW,
      batteryExportMWh: flows.get('batteryDischarge-gridExport')?.mwh ?? 0,
    },
  }
}
