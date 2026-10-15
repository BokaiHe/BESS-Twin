import type { Localized } from '../domain/types'
export type GlossaryId =
  | 'soc'
  | 'soh'
  | 'mw'
  | 'mwh'
  | 'duration'
  | 'pcs'
  | 'bms'
  | 'ems'
  | 'grid-import'
  | 'grid-export'
  | 'peak-shaving'
  | 'arbitrage'
  | 'valley'
  | 'flat'
  | 'peak'
  | 'curtailment'
  | 'clipping'
  | 'efficiency'
  | 'periodic'
  | 'unserved'
  | 'cell'
  | 'module'
  | 'rack'
  | 'voltage'
  | 'ac-dc'
  | 'available-power'
  | 'pv-capacity'
  | 'wind-capacity'
  | 'soc-min'
  | 'soc-max'
  | 'charge-efficiency'
  | 'discharge-efficiency'
  | 'reserve'
  | 'absorb'
  | 'standby'
export interface GlossaryEntry {
  id: GlossaryId
  term: Localized
  short: Localized
  long?: Localized
  analogy?: Localized
  related?: GlossaryId[]
}
export const GLOSSARY: readonly GlossaryEntry[] = [
  {
    id: 'soc',
    term: { zh: 'SOC（荷电状态）', en: 'SOC (state of charge)' },
    short: {
      zh: '当前储存电量占安装容量的比例。',
      en: 'Stored energy as a fraction of installed capacity.',
    },
    analogy: {
      zh: '示意：像水箱的水位；可用范围受上下限约束。',
      en: 'Illustrative analogy: like a tank’s water level; operating limits restrict its usable range.',
    },
    related: ['mwh', 'soc-min', 'soc-max'],
  },
  {
    id: 'soh',
    term: { zh: 'SOH（健康状态）', en: 'SOH (state of health)' },
    short: {
      zh: '电池当前能力相对新电池的状态指标；本演示为示例值。',
      en: 'Battery condition relative to a new battery; illustrative in this demo.',
    },
    related: ['soc'],
  },
  {
    id: 'mw',
    term: { zh: '功率 MW', en: 'Power (MW)' },
    short: {
      zh: '描述此刻传输电能有多快，不代表能存多少。',
      en: 'The rate of energy transfer, not the amount that can be stored.',
    },
    analogy: {
      zh: '示意：像水管的流量能力。',
      en: 'Illustrative analogy: like the flow capacity of a pipe.',
    },
    related: ['mwh', 'duration'],
  },
  {
    id: 'mwh',
    term: { zh: '容量 / 电量 MWh', en: 'Capacity / energy (MWh)' },
    short: {
      zh: '容量是可储存电量的额定大小；电量是实际储存或传输的量。',
      en: 'Capacity describes rated storage size; energy describes the amount stored or transferred.',
    },
    analogy: {
      zh: '示意：像水箱大小与其中的水量。',
      en: 'Illustrative analogy: like tank size and the water inside.',
    },
    related: ['mw', 'soc', 'duration'],
  },
  {
    id: 'duration',
    term: { zh: '额定时长', en: 'Rated duration' },
    short: {
      zh: '额定容量除以额定功率；实际持续时间还受水位、效率和限制影响。',
      en: 'Rated energy divided by rated power; actual runtime also depends on SOC, efficiency and limits.',
    },
    related: ['mw', 'mwh', 'efficiency'],
  },
  {
    id: 'pcs',
    term: { zh: 'PCS（储能变流器）', en: 'PCS (power conversion system)' },
    short: {
      zh: '在电池直流侧与电网交流侧之间双向转换电能。',
      en: 'Converts power in both directions between the DC battery and the AC network.',
    },
    related: ['ac-dc', 'bms', 'voltage'],
  },
  {
    id: 'bms',
    term: { zh: 'BMS（电池管理系统）', en: 'BMS (battery management system)' },
    short: {
      zh: '监测电芯状态，执行均衡并给出电池的安全运行限制。',
      en: 'Monitors cells, balances them and establishes safe battery operating limits.',
    },
    related: ['cell', 'rack', 'pcs'],
  },
  {
    id: 'ems',
    term: { zh: 'EMS（能量管理系统）', en: 'EMS (energy management system)' },
    short: {
      zh: '根据用电需求、能源和运行限制安排系统充放电。',
      en: 'Schedules system charging and discharging using demand, generation and operating constraints.',
    },
    related: ['peak-shaving', 'arbitrage'],
  },
  {
    id: 'grid-import',
    term: { zh: '并网点 / 购电上限', en: 'Grid connection / import limit' },
    short: {
      zh: '园区从外部电网取电的功率上限；不足部分需由本地电源补足。',
      en: 'Maximum power the site can import; local sources must cover any remaining demand.',
    },
    related: ['peak-shaving', 'unserved'],
  },
  {
    id: 'grid-export',
    term: { zh: '上网功率上限', en: 'Grid export limit' },
    short: {
      zh: '允许送到外部电网的最大功率，超过且无法存储时可能弃电。',
      en: 'Maximum power exported to the utility; excess that cannot be stored may be curtailed.',
    },
    related: ['curtailment', 'grid-import'],
  },
  {
    id: 'peak-shaving',
    term: { zh: '削峰', en: 'Peak shaving' },
    short: {
      zh: '通过储能补足高负荷时段的用电，降低电网购电功率。',
      en: 'Uses storage to supply high-demand periods and reduce grid import power.',
    },
    related: ['grid-import', 'reserve', 'available-power'],
  },
  {
    id: 'arbitrage',
    term: { zh: '峰谷套利', en: 'Tariff arbitrage' },
    short: {
      zh: '低价时充电、高价时放电，收益还要扣除损耗等影响。',
      en: 'Charges at lower prices and discharges at higher prices; losses affect the benefit.',
    },
    related: ['valley', 'flat', 'peak', 'efficiency'],
  },
  {
    id: 'valley',
    term: { zh: '谷时电价', en: 'Off-peak tariff' },
    short: {
      zh: '通常安排在低用电需求时段的电价；本模型的时段固定。',
      en: 'Tariff for typically lower-demand hours; this model uses fixed time windows.',
    },
    related: ['arbitrage', 'flat', 'peak'],
  },
  {
    id: 'flat',
    term: { zh: '平时电价', en: 'Mid-peak tariff' },
    short: {
      zh: '位于谷时与峰时之间的电价时段；本模型可在此时补电。',
      en: 'Intermediate tariff period; the model may top up storage during this window.',
    },
    related: ['valley', 'peak'],
  },
  {
    id: 'peak',
    term: { zh: '峰时电价', en: 'Peak tariff' },
    short: {
      zh: '通常较贵的电价时段；储能会在保留削峰电量后参与放电。',
      en: 'Typically higher-price hours; storage discharges while retaining its shaving reserve.',
    },
    related: ['arbitrage', 'reserve'],
  },
  {
    id: 'curtailment',
    term: { zh: '弃风弃光', en: 'Renewable curtailment' },
    short: {
      zh: '受负荷、储能或上网限制，原本可用的风光电未被利用。',
      en: 'Available renewable output left unused because of load, storage or export constraints.',
    },
    related: ['clipping', 'grid-export'],
  },
  {
    id: 'clipping',
    term: { zh: '逆变器削顶', en: 'Inverter clipping' },
    short: {
      zh: '光伏直流潜在出力超过逆变器交流容量而损失的部分。',
      en: 'PV DC potential exceeding the inverter’s AC capacity.',
    },
    related: ['pv-capacity', 'curtailment', 'ac-dc'],
  },
  {
    id: 'efficiency',
    term: { zh: '充放电效率', en: 'Charge / discharge efficiency' },
    short: {
      zh: '输入电能并非全部能在输出端取回，部分以损耗形式消耗。',
      en: 'Not all input energy is recovered at the output; some is lost.',
    },
    related: ['charge-efficiency', 'discharge-efficiency'],
  },
  {
    id: 'periodic',
    term: { zh: '周期稳态', en: 'Periodic steady state' },
    short: {
      zh: '全天结束电量回到初始值，避免把初始库存当成每日节省。',
      en: 'End-of-day energy returns to its initial value, avoiding savings borrowed from initial inventory.',
    },
    related: ['mwh', 'unserved'],
  },
  {
    id: 'unserved',
    term: { zh: '未供电量', en: 'Unserved energy' },
    short: {
      zh: '需求未被满足的电量；少供电导致的账单下降不算储能节省。',
      en: 'Energy demand not supplied; a lower bill from unmet demand is not storage savings.',
    },
    related: ['grid-import', 'periodic'],
  },
  {
    id: 'cell',
    term: { zh: '电芯', en: 'Battery cell' },
    short: {
      zh: '储存化学能并与电能相互转换的基本电化学单元。',
      en: 'The basic electrochemical unit that stores chemical energy and exchanges electrical energy.',
    },
    related: ['module', 'bms'],
  },
  {
    id: 'module',
    term: { zh: '电池模组', en: 'Battery module' },
    short: {
      zh: '多个电芯组合成的单元，便于监测、连接和热管理。',
      en: 'A group of cells organized for connection, monitoring and thermal management.',
    },
    related: ['cell', 'rack'],
  },
  {
    id: 'rack',
    term: { zh: '电池簇', en: 'Battery rack' },
    short: {
      zh: '多个模组连接组成的储能单元，接受簇级管理与保护。',
      en: 'Connected modules forming a storage assembly with rack-level monitoring and protection.',
    },
    related: ['module', 'bms'],
  },
  {
    id: 'voltage',
    term: { zh: '额定电压', en: 'Nominal voltage' },
    short: {
      zh: '设备或网络的设计电压等级；页面显示额定值，不是实时测量值。',
      en: 'The design voltage level; displayed ratings are not live measurements.',
    },
    related: ['pcs', 'ac-dc'],
  },
  {
    id: 'ac-dc',
    term: { zh: '直流 / 交流', en: 'DC / AC' },
    short: {
      zh: '直流方向固定，交流周期变化；变流器负责两者之间转换。',
      en: 'DC flows in one direction; AC alternates periodically. Converters connect the two.',
    },
    related: ['pcs', 'voltage'],
  },
  {
    id: 'available-power',
    term: { zh: '可用放电能力', en: 'Available discharge power' },
    short: {
      zh: '此刻考虑在线设备、电量和限制后，能够释放的功率。',
      en: 'Power available now after accounting for online equipment, stored energy and operating limits.',
    },
    related: ['mw', 'soc', 'reserve'],
  },
  {
    id: 'pv-capacity',
    term: { zh: '光伏直流装机', en: 'PV DC capacity' },
    short: {
      zh: '光伏阵列的直流额定容量，与逆变器交流输出上限不同。',
      en: 'The array’s rated DC capacity, distinct from the inverter’s AC output limit.',
    },
    related: ['clipping', 'mw'],
  },
  {
    id: 'wind-capacity',
    term: { zh: '风电装机', en: 'Wind capacity' },
    short: {
      zh: '风机额定功率之和；实际出力还取决于风况。',
      en: 'Sum of turbine rated power; actual output also depends on wind conditions.',
    },
    related: ['mw'],
  },
  {
    id: 'soc-min',
    term: { zh: 'SOC 下限', en: 'Minimum SOC' },
    short: {
      zh: '调度允许使用的最低荷电状态；下方电量保留不用。',
      en: 'Lowest permitted state of charge; energy below it is retained.',
    },
    related: ['soc', 'soc-max'],
  },
  {
    id: 'soc-max',
    term: { zh: 'SOC 上限', en: 'Maximum SOC' },
    short: {
      zh: '调度允许充到的最高荷电状态，不一定充满全部安装容量。',
      en: 'Highest permitted state of charge; charging need not fill the entire installed capacity.',
    },
    related: ['soc', 'soc-min'],
  },
  {
    id: 'charge-efficiency',
    term: { zh: '充电效率', en: 'Charge efficiency' },
    short: {
      zh: '储存到电池的直流电量与交流侧充入电量的比例。',
      en: 'DC energy stored divided by AC energy supplied for charging.',
    },
    related: ['efficiency', 'discharge-efficiency'],
  },
  {
    id: 'discharge-efficiency',
    term: { zh: '放电效率', en: 'Discharge efficiency' },
    short: {
      zh: '交流侧送出的电量与电池减少的直流电量的比例。',
      en: 'AC energy delivered divided by DC energy removed from the battery.',
    },
    related: ['efficiency', 'charge-efficiency'],
  },
  {
    id: 'reserve',
    term: { zh: '削峰预留电量', en: 'Shaving reserve' },
    short: {
      zh: '为应对之后的购电限制而保留的电量，优先于峰价套利。',
      en: 'Energy retained for later grid-limit constraints, taking priority over tariff arbitrage.',
    },
    related: ['peak-shaving', 'mwh'],
  },
  {
    id: 'absorb',
    term: { zh: '风光消纳', en: 'Renewable absorption' },
    short: {
      zh: '把暂时多余的清洁电存起来，供其他时段使用。',
      en: 'Stores temporarily surplus renewable energy for use at another time.',
    },
    related: ['curtailment', 'mwh'],
  },
  {
    id: 'standby',
    term: { zh: '待机', en: 'Standby' },
    short: {
      zh: '此刻不充电也不放电，但可以保留电量等待后续需求。',
      en: 'Neither charging nor discharging now; energy can be retained for later demand.',
    },
    related: ['reserve', 'soc'],
  },
]
/** Search both languages so familiar acronyms and translated terms both work. */
export function searchGlossary(query: string): readonly GlossaryEntry[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return GLOSSARY.filter((entry) => {
    const text = [
      entry.term.zh,
      entry.term.en,
      entry.short.zh,
      entry.short.en,
      entry.analogy?.zh,
      entry.analogy?.en,
    ]
      .join(' ')
      .toLocaleLowerCase()
    return words.every((word) => text.includes(word))
  })
}
