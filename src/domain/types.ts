import type { SimulationParameters, SimulationDiagnostics } from './parameters'
export type Lang = 'zh' | 'en'
export interface Localized {
  readonly zh: string
  readonly en: string
}
export type ScenarioId = 'sunny' | 'cloudy' | 'fault'
export type Quality = 'good' | 'stale' | 'missing' | 'disconnected'
export type NodeKind =
  'grid' | 'transformer' | 'bus' | 'pv' | 'wind' | 'bess' | 'factory' | 'residential'
export type NodeId =
  | 'grid'
  | 'pcc'
  | 'bus'
  | 'pv'
  | 'wind-1'
  | 'wind-2'
  | 'wind-3'
  | 'bess-1'
  | 'bess-2'
  | 'bess-3'
  | 'bess-4'
  | 'distribution'
  | 'factory'
  | 'lv'
  | 'residential'
export interface TopologyNode {
  readonly id: NodeId
  readonly name: Localized
  readonly kind: NodeKind
  readonly voltage: string
  readonly rating: Localized
  /** Scene position [x, y, z]; ground plane is y = 0. */
  readonly position: readonly [number, number, number]
}
export interface TopologyEdge {
  readonly id: string
  readonly from: NodeId
  readonly to: NodeId
  readonly capacityMW: number
  /** Visual cable route waypoints [x, z] between the two end nodes (scene only). */
  readonly route?: readonly (readonly [number, number])[]
}
export interface NodeState {
  readonly id: NodeId
  /** Positive = injection into the network; negative = withdrawal. */
  readonly injectionMW: number
  readonly status: 'online' | 'offline'
  readonly quality: Quality
  readonly socPct?: number
  readonly nextSocPct?: number
  readonly temperatureC?: number
  readonly sohPct?: number
  readonly availableDischargeMW?: number
}
export interface EdgeState {
  readonly id: string
  /** Positive along topology from -> to, negative in the reverse direction. */
  readonly powerMW: number
  readonly activeUtilizationPct: number
  readonly quality: Quality
}
export type TariffBand = 'valley' | 'flat' | 'peak'
export interface Tariff {
  readonly band: TariffBand
  readonly importCnyPerKWh: number
  readonly exportCnyPerKWh: number
}
export type AlarmCode = 'bess-temp-high' | 'bess-overheat-trip'
export interface Alarm {
  readonly id: string
  readonly code: AlarmCode
  readonly severity: 'warning' | 'critical'
  readonly nodeId: NodeId
  readonly startedAtMinute: number
}
/** Language-neutral strategy codes; the UI translates them. */
export type StrategyCode =
  | 'hard-shave'
  | 'absorb'
  | 'export-surplus'
  | 'valley-charge'
  | 'flat-charge'
  | 'peak-discharge'
  | 'hold-reserve'
  | 'standby'
export interface Snapshot {
  readonly parameters: SimulationParameters
  readonly schemaVersion: 2
  readonly source: 'simulation' | 'live'
  readonly timestamp: string
  readonly receivedAt: string
  readonly quality: Quality
  readonly minute: number
  readonly scenarioId: ScenarioId
  readonly nodes: Readonly<Record<NodeId, NodeState>>
  readonly edges: Readonly<Record<string, EdgeState>>
  readonly alarms: readonly Alarm[]
  readonly tariff: Tariff
  readonly strategy: {
    readonly code: StrategyCode
    /** Planned peak-period grid import level the cluster flattens towards. */
    readonly peakLevelMW: number
    /** Online-cluster stored-energy target before the next peak window (DC MWh), if charging for it. */
    readonly chargeTargetMWh: number | null
    readonly reserveMWh: number
    /** True after the plan was recomputed because of an equipment event. */
    readonly replanned: boolean
  }
  readonly metrics: {
    readonly pvMW: number
    readonly windMW: number
    readonly renewableMW: number
    readonly pvDcPotentialMW: number
    readonly pvClippingMW: number
    readonly curtailedMW: number
    readonly demandMW: number
    readonly servedMW: number
    readonly unservedMW: number
    readonly gridImportMW: number
    readonly gridExportMW: number
    readonly batteryChargeMW: number
    readonly batteryDischargeMW: number
    readonly socPct: number
    readonly onlineSocPct: number
    readonly onlinePowerLimitMW: number
    readonly availableDischargeMW: number
    readonly onlineCapacityMWh: number
    /** Stored battery energy (all units) and its change since 00:00, DC side. */
    readonly storedMWh: number
    readonly storedDeltaMWh: number
    /** Cumulative values through the START of this minute, excluding this interval. */
    readonly costCny: number
    readonly baselineCostCny: number
    readonly estimatedSavingsCny: number | null
    readonly baselineUnservedMWh: number
  }
}
export interface SimulationDay {
  readonly parameters: SimulationParameters
  readonly diagnostics: SimulationDiagnostics
  readonly id: ScenarioId
  readonly frames: readonly Snapshot[]
  readonly summary: {
    readonly importMWh: number
    readonly exportMWh: number
    readonly unservedMWh: number
    readonly clippingMWh: number
    readonly curtailedMWh: number
    readonly costCny: number
    readonly baselineCostCny: number
    readonly baselineUnservedMWh: number
    readonly initialStoredMWh: number
    readonly finalStoredMWh: number
    readonly peakLevelMW: number
  }
}
/** A live adapter validates and normalizes measurements into this same UI contract. */
export interface TwinDataSource {
  readonly mode: 'simulation' | 'live'
  loadDay(scenarioId: ScenarioId): Promise<SimulationDay>
  subscribe?(onSnapshot: (snapshot: Snapshot) => void): () => void
}
