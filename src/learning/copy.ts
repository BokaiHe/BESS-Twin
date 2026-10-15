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
