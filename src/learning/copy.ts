import type { Lang } from '../domain/types'
interface LearningCopy {
  glossary: string
  search: string
  empty: string
  view: string
  close: string
  loading: string
  related: string
  analogy: string
  intro: string
  explain: string
}
export const learningCopy: Record<Lang, LearningCopy> = {
  en: {
    glossary: 'Energy glossary',
    search: 'Search terms',
    empty: 'No matching terms.',
    view: 'View in glossary',
    close: 'Close explanation',
    loading: 'Loading explanation…',
    related: 'Related terms',
    analogy: 'An everyday analogy',
    intro:
      'Plain-language explanations for this simulation. Underlined terms open a short explanation.',
    explain: 'Explain',
  },
  zh: {
    glossary: '能源术语表',
    search: '搜索术语',
    empty: '没有找到匹配的术语。',
    view: '在术语表中查看',
    close: '关闭解释',
    loading: '正在加载解释…',
    related: '相关术语',
    analogy: '生活中的类比',
    intro: '用简单的话解释仿真中的概念。点击带下划线的术语即可查看简短说明。',
    explain: '解释',
  },
}

interface TankCopy {
  title: string
  previewLabel: string
  liveLabel: string
  pause: string
  resume: string
  charging: string
  discharging: string
  idle: string
  preview: string
  noTank: string
  closed: string
  explanation: string
  noLevel: string
  snapshotNote: string
  limits: string
  scale: (capacity: number, power: number) => string
  level: string
  range: string
  hours: string
  nominal: string
  original: string
  how: string
}
export const tankCopy: Record<Lang, TankCopy> = {
  en: {
    title: 'Storage as a water tank',
    previewLabel: 'Capacity preview · illustrative',
    liveLabel: 'Selected minute · illustrative motion',
    pause: 'Pause water animation',
    resume: 'Resume water animation',
    charging: 'Charging · water flows in',
    discharging: 'Discharging · water flows out',
    idle: 'Idle · no flow',
    preview: 'Capacity preview · no simulated water level',
    noTank: 'No storage tank',
    closed: 'Cannot charge or discharge · pipe closed',
    explanation:
      'Tank size represents energy capacity (MWh). Pipe thickness represents rated power (MW). Water level represents the fraction of energy stored (SOC). Arrows show the direction of energy flow.',
    noLevel:
      'This is the parameter draft, not a calculated snapshot. The hatched band marks the permitted SOC range; it is not water. No previous result is used as the new water level.',
    snapshotNote:
      'Water level reads the selected minute, including energy retained in offline units. Moving dashes illustrate the current AC charge or discharge power; animation never adds or removes simulated energy.',
    limits:
      'Nominal duration uses the whole nameplate capacity. Usable duration also depends on SOC limits, conversion losses and available units. Pipe size is rated power, not a promise of currently available power.',
    scale: (capacity, power) =>
      `Fixed scale: up to ${capacity} MWh and ${power} MW. Very small tanks and pipes have a minimum visible size.`,
    level: 'Stored',
    range: 'Usable SOC window',
    hours: 'h',
    nominal: 'Nominal full-capacity duration',
    original: 'Original (dashed)',
    how: 'How to read this analogy',
  },
  zh: {
    title: '把储能想成水箱',
    previewLabel: '容量预览 · 示意',
    liveLabel: '当前时刻 · 流动速度为示意',
    pause: '暂停水流动画',
    resume: '继续水流动画',
    charging: '充电 · 水流入箱内',
    discharging: '放电 · 水流出箱外',
    idle: '待机 · 没有水流',
    preview: '容量预览 · 尚无仿真水位',
    noTank: '没有储能水箱',
    closed: '无法充放电 · 水管已关闭',
    explanation:
      '水箱大小表示储能容量（MWh），水管粗细表示额定功率（MW），水位表示已储存电量占容量的比例（SOC）。箭头表示能量流动方向。',
    noLevel:
      '这里展示参数草稿，不是已计算的快照。斜线区域表示允许使用的 SOC 区间，不是水位；不会把旧方案电量当成新方案水位。',
    snapshotNote:
      '水位读取所选时刻，包含离线单元保留的电量。流动虚线示意当前交流侧充放电功率；动画本身不会累加或减少仿真电量。',
    limits:
      '标称时长按全部铭牌容量计算。实际可用时长还取决于 SOC 上下限、转换损耗及在线单元。管道大小表示额定功率，不代表当前一定能提供该功率。',
    scale: (capacity, power) =>
      `固定比例尺：最大 ${capacity} MWh、${power} MW。很小的水箱和水管保留最小可见尺寸。`,
    level: '储存电量',
    range: '可用 SOC 区间',
    hours: '小时',
    nominal: '全部铭牌容量对应的标称时长',
    original: '原方案（虚线）',
    how: '如何理解这个类比',
  },
}

interface FlowCopy {
  title: string
  entry: string
  hint: string
  dismiss: string
  loading: string
  intro: string
  scope: string
  day: string
  now: string
  empty: string
  sources: string
  sinks: string
  table: string
  from: string
  to: string
  energy: string
  outside: string
  curtailed: string
  clipping: string
  unserved: string
  storage: string
  initial: string
  final: string
  delta: string
  loss: string
  lossFormula: string
  inventoryNote: string
  windowNote: string
  unexpectedExport: string
  select: string
  labels: Record<
    'pv' | 'wind' | 'gridImport' | 'batteryDischarge' | 'load' | 'batteryCharge' | 'gridExport',
    string
  >
  short: Record<
    'pv' | 'wind' | 'gridImport' | 'batteryDischarge' | 'load' | 'batteryCharge' | 'gridExport',
    string
  >
}
export const flowCopy: Record<Lang, FlowCopy> = {
  en: {
    title: 'Where the energy goes',
    entry: 'View energy flows',
    hint: 'The day is complete. See where its energy went.',
    dismiss: 'Dismiss energy summary',
    loading: 'Loading energy flows…',
    intro:
      'Illustrative accounting of the applied simulation. Band width represents energy (MWh), not instantaneous power. This is a source-allocation convention, not a trace of individual electrons.',
    scope: 'Energy flow time window',
    day: 'Full day',
    now: 'Up to',
    empty: 'No energy transferred in this interval.',
    sources: 'Sources',
    sinks: 'Destinations',
    table: 'View the energy table',
    from: 'From',
    to: 'To',
    energy: 'Energy (MWh)',
    outside: 'Outside the flow balance',
    curtailed: 'Renewable curtailment (network)',
    clipping: 'PV inverter clipping',
    unserved: 'Unserved demand',
    storage: 'Storage inventory and losses',
    initial: 'Starting stored energy',
    final: 'Ending stored energy',
    delta: 'Stored energy change',
    loss: 'Conversion loss',
    lossFormula: 'AC charging − AC discharge − DC stored-energy change',
    inventoryNote:
      'Inventory includes energy retained in offline units. Charging and discharging are separate AC transfers, so their sum is not unique energy production. Losses are already accounted for by the storage inventory change; they are not an extra Sankey destination.',
    windowNote:
      'Includes one-minute intervals from 00:00 up to, but not including, the selected endpoint. Full day includes the last minute and uses the 24:00 inventory.',
    unexpectedExport:
      'This result includes battery exports; they are explicitly included in the allocation.',
    select: 'Select a band to inspect its energy transfer.',
    labels: {
      pv: 'Solar PV',
      wind: 'Wind power',
      gridImport: 'Grid imports',
      batteryDischarge: 'Storage discharge',
      load: 'Served load',
      batteryCharge: 'Storage charging',
      gridExport: 'Grid exports',
    },
    short: {
      pv: 'Solar PV',
      wind: 'Wind',
      gridImport: 'Grid in',
      batteryDischarge: 'Discharge',
      load: 'Load',
      batteryCharge: 'Charge',
      gridExport: 'Grid out',
    },
  },
  zh: {
    title: '能量去了哪里',
    entry: '查看能量去向',
    hint: '一天播放完成，看看今天的能量去了哪里。',
    dismiss: '关闭能量总结提示',
    loading: '正在加载能量去向…',
    intro:
      '基于已应用仿真结果的归因示意。流带宽度表示电量（MWh），不是瞬时功率；这是约定的来源分配，不是追踪真实电子。',
    scope: '能量统计时段',
    day: '全天',
    now: '截至',
    empty: '该时间段尚无能量传输。',
    sources: '来源',
    sinks: '去向',
    table: '查看能量数据表',
    from: '来源',
    to: '去向',
    energy: '电量（MWh）',
    outside: '不计入流向平衡的量',
    curtailed: '网络限制造成的弃风弃光',
    clipping: '光伏逆变器削顶',
    unserved: '未供电需求',
    storage: '储能库存与损耗',
    initial: '期初储存电量',
    final: '期末储存电量',
    delta: '储存电量变化',
    loss: '转换损耗',
    lossFormula: '交流充入电量 − 交流放出电量 − 直流库存变化',
    inventoryNote:
      '库存包含离线单元保留的电量。充电和放电是两次不同的交流侧传输，不能将两者相加视为一次能源产出；损耗通过库存变化核算，不重复添加为桑基图的去向。',
    windowNote:
      '统计 00:00 起、截至所选时刻之前的一分钟区间。全天包含最后一分钟，使用 24:00 的库存。',
    unexpectedExport: '该结果包含储能上网电量，已明确分配并计入。',
    select: '点击流带查看对应的能量传输。',
    labels: {
      pv: '光伏',
      wind: '风电',
      gridImport: '电网购电',
      batteryDischarge: '储能放电',
      load: '实际供电负荷',
      batteryCharge: '储能充电',
      gridExport: '电网上网',
    },
    short: {
      pv: '光伏',
      wind: '风电',
      gridImport: '购电',
      batteryDischarge: '放电',
      load: '负荷',
      batteryCharge: '充电',
      gridExport: '上网',
    },
  },
}
