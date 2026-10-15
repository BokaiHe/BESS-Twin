import { NODE_BY_ID } from '../domain/topology'
import type { Selection } from '../components/scene/shared'
import { useI18n } from '../i18n'

/** Static AC topology ratings, never a substitute for measured node voltage. */
export function VoltageInfo({
  selection,
  compact = false,
}: {
  selection: Selection
  compact?: boolean
}) {
  const { t } = useI18n()
  const node = NODE_BY_ID[selection === 'bess-cluster' ? 'bus' : selection]
  const storage = selection === 'bess-cluster' || node.kind === 'bess'
  const voltage = storage ? NODE_BY_ID.bus.voltage : node.voltage
  const label = storage ? t.detail.connectionVoltage : t.detail.voltage

  if (compact) {
    return (
      <span className="device-voltage">
        <span>{label}</span>
        <b>{voltage}</b>
      </span>
    )
  }
  return (
    <section className="voltage-info" aria-label={label}>
      <div className="voltage-heading">
        <span>{label}</span>
        <strong>{voltage}</strong>
      </div>
      <p>{t.detail.voltageNote}</p>
      {storage && <p>{t.detail.storageVoltageNote}</p>}
      {!storage && voltage.includes('/') && <p>{t.detail.voltageSidesNote}</p>}
    </section>
  )
}
