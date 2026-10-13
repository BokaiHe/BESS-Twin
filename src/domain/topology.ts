import type { NodeId, TopologyEdge, TopologyNode } from './types'

export const BESS_X = [-2.6, 0.8, 4.2, 7.6] as const
export const BESS_Z = 5.2
const WIND_POS = [
  [-24, -4],
  [-20, -7],
  [-16, -10],
] as const

export const NODES: readonly TopologyNode[] = [
  {
    id: 'grid',
    name: { zh: '外部电网', en: 'Utility grid' },
    kind: 'grid',
    voltage: '110 kV',
    rating: { zh: '购电 / 上网各 15 MW', en: '15 MW import / export' },
    position: [10, 0, -15.5],
  },
  {
    id: 'pcc',
    name: { zh: '并网主变', en: 'Main transformer' },
    kind: 'transformer',
    voltage: '110 / 35 kV',
    rating: { zh: '并网交换上限 15 MW', en: 'PCC limit 15 MW' },
    position: [-3, 0, -10],
  },
  {
    id: 'bus',
    name: { zh: '35 kV 汇集站', en: '35 kV collector' },
    kind: 'bus',
    voltage: '35 kV',
    rating: { zh: '源网荷储汇集节点', en: 'Common coupling bus' },
    position: [0, 0, -3],
  },
  {
    id: 'pv',
    name: { zh: '光伏电站', en: 'Solar farm' },
    kind: 'pv',
    voltage: '0.8 / 35 kV',
    rating: { zh: '20 MWp / 16 MWac', en: '20 MWp / 16 MWac' },
    position: [-14, 0, 5.5],
  },
  ...WIND_POS.map(([x, z], i): TopologyNode => ({
    id: `wind-${i + 1}` as NodeId,
    name: { zh: `风机 WT-0${i + 1}`, en: `Turbine WT-0${i + 1}` },
    kind: 'wind',
    voltage: '0.69 / 35 kV',
    rating: { zh: '4 MW', en: '4 MW' },
    position: [x, 0, z],
  })),
  ...BESS_X.map((x, i): TopologyNode => ({
    id: `bess-${i + 1}` as NodeId,
    name: { zh: `储能 BESS-0${i + 1}`, en: `BESS-0${i + 1}` },
    kind: 'bess',
    voltage: 'PCS · 35 kV',
    rating: { zh: '2.5 MW / 5 MWh', en: '2.5 MW / 5 MWh' },
    position: [x, 0, BESS_Z],
  })),
  {
    id: 'distribution',
    name: { zh: '园区配电站', en: 'Distribution substation' },
    kind: 'transformer',
    voltage: '35 / 10 kV',
    rating: { zh: '工业及低压配电', en: 'Feeds industry and LV' },
    position: [9, 0, -4],
  },
  {
    id: 'factory',
    name: { zh: '工业园区', en: 'Industrial park' },
    kind: 'factory',
    voltage: '10 kV',
    rating: { zh: '日内负荷 6–14 MW', en: 'Daily load 6–14 MW' },
    position: [17, 0, -9],
  },
  {
    id: 'lv',
    name: { zh: '配电变压器', en: 'LV transformer' },
    kind: 'transformer',
    voltage: '10 / 0.4 kV',
    rating: { zh: '居民及充电配电', en: 'Homes and EV charging' },
    position: [14, 0, 1.5],
  },
  {
    id: 'residential',
    name: { zh: '居民与充电区', en: 'Homes & EV hub' },
    kind: 'residential',
    voltage: '0.4 kV',
    rating: { zh: '日内负荷 1–5 MW', en: 'Daily load 1–5 MW' },
    position: [19.5, 0, 3],
  },
]
export const EDGES: readonly TopologyEdge[] = [
  { id: 'grid-pcc', from: 'grid', to: 'pcc', capacityMW: 15 },
  { id: 'pcc-bus', from: 'pcc', to: 'bus', capacityMW: 15, route: [[-3, -3]] },
  {
    id: 'pv-bus',
    from: 'pv',
    to: 'bus',
    capacityMW: 16,
    route: [
      [-8, 5.5],
      [-8, -0.6],
      [-0.6, -0.6],
    ],
  },
  ...WIND_POS.map(([x], i): TopologyEdge => ({
    id: `wind-${i + 1}-bus`,
    from: `wind-${i + 1}` as NodeId,
    to: 'bus',
    capacityMW: 4,
    route: [
      [x, -1.6],
      [-1.2, -1.6],
    ],
  })),
  ...BESS_X.map((x, i): TopologyEdge => ({
    id: `bus-bess-${i + 1}`,
    from: 'bus',
    to: `bess-${i + 1}` as NodeId,
    capacityMW: 2.5,
    route: [
      [0.8, -3],
      [0.8, 1.8],
      [x, 1.8],
    ],
  })),
  { id: 'bus-distribution', from: 'bus', to: 'distribution', capacityMW: 19, route: [[9, -3]] },
  {
    id: 'distribution-factory',
    from: 'distribution',
    to: 'factory',
    capacityMW: 14,
    route: [[9, -9]],
  },
  { id: 'distribution-lv', from: 'distribution', to: 'lv', capacityMW: 5, route: [[14, -4]] },
  { id: 'lv-residential', from: 'lv', to: 'residential', capacityMW: 5, route: [[14, 3]] },
]
export const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n])) as Record<
  NodeId,
  TopologyNode
>
export const BESS_IDS = ['bess-1', 'bess-2', 'bess-3', 'bess-4'] as const satisfies NodeId[]
export const WIND_IDS = ['wind-1', 'wind-2', 'wind-3'] as const satisfies NodeId[]
export function connectedEdgeIds(nodeId: NodeId): string[] {
  return EDGES.filter((e) => e.from === nodeId || e.to === nodeId).map((e) => e.id)
}
