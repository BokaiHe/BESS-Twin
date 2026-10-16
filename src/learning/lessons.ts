import { timeLabel } from '../domain/config'
import type { Localized } from '../domain/types'
import { DEFAULT_PARAMETERS, parameterKey } from '../domain/parameters'
import { studyKey, type StudyResult } from '../data/studyProtocol'
import type { Lesson, Template } from './lessonTypes'
const L = (en: string, zh: string): Localized => ({ en, zh })
const say =
  (en: string, zh: string): Template =>
  (_s, _d, _c, lang) =>
    lang === 'zh' ? zh : en
const n = (v: number) => v.toFixed(2)
const flows: Template = (s, _d, _c, lang) => {
  const m = s.metrics
  return lang === 'zh'
    ? `${timeLabel(s.minute)}：风光发电 ${n(m.renewableMW)} MW，负荷 ${n(m.demandMW)} MW；储能充电 ${n(m.batteryChargeMW)} MW，上网 ${n(m.gridExportMW)} MW，弃风弃光 ${n(m.curtailedMW)} MW。这些去向可能同时存在。`
    : `At ${timeLabel(s.minute)}: renewables ${n(m.renewableMW)} MW, demand ${n(m.demandMW)} MW; charging ${n(m.batteryChargeMW)} MW, export ${n(m.gridExportMW)} MW and curtailment ${n(m.curtailedMW)} MW. More than one destination can be active.`
}
const peak: Template = (s, _d, _c, lang) =>
  lang === 'zh'
    ? `${timeLabel(s.minute)}：储能放电 ${n(s.metrics.batteryDischargeMW)} MW，购电 ${n(s.metrics.gridImportMW)} MW。调度削峰水位为 ${n(s.strategy.peakLevelMW)} MW；这是目标水位，不是任何时刻都能维持的保证。剩余电量 ${n(s.metrics.storedMWh)} MWh。`
    : `At ${timeLabel(s.minute)}, storage discharges at ${n(s.metrics.batteryDischargeMW)} MW and grid import is ${n(s.metrics.gridImportMW)} MW. The planned shaving level is ${n(s.strategy.peakLevelMW)} MW: a dispatch target, not a guarantee at every minute. Stored energy is ${n(s.metrics.storedMWh)} MWh.`
const reserve: Template = (s, _d, _c, lang) => {
  const target = s.strategy.chargeTargetMWh
  return lang === 'zh'
    ? `${timeLabel(s.minute)}：谷电价格 ${n(s.tariff.importCnyPerKWh)} CNY/kWh，充电 ${n(s.metrics.batteryChargeMW)} MW。${target === null ? '当前没有充电目标。' : `当前充电目标 ${n(target)} MWh。`}调度根据未来供需预留能量，并非电池保养指令。`
    : `At ${timeLabel(s.minute)}, the valley price is ${n(s.tariff.importCnyPerKWh)} CNY/kWh and charging is ${n(s.metrics.batteryChargeMW)} MW. ${target === null ? 'No charging target is active.' : `The charging target is ${n(target)} MWh.`} The schedule reserves energy for later supply and demand; this is not a battery maintenance command.`
}
const fault: Template = (s, _d, c, lang) => {
  const sunny = c.sunny.frames[s.minute],
    delta = s.metrics.gridImportMW - sunny.metrics.gridImportMW
  const online = Object.values(s.nodes).filter(
    (x) => x.id.startsWith('bess-') && x.status !== 'offline',
  ).length
  return lang === 'zh'
    ? `${timeLabel(s.minute)}：在线储能 ${online} 台，可用额定功率 ${n(s.metrics.onlinePowerLimitMW)} MW。购电 ${n(s.metrics.gridImportMW)} MW，同参数晴天为 ${n(sunny.metrics.gridImportMW)} MW（差额 ${n(delta)} MW）。离线单元保留的电量不能用于供电。`
    : `At ${timeLabel(s.minute)}, ${online} storage units are online, with ${n(s.metrics.onlinePowerLimitMW)} MW of online rated power. Grid import is ${n(s.metrics.gridImportMW)} MW versus ${n(sunny.metrics.gridImportMW)} MW on the same-parameter sunny day (difference ${n(delta)} MW). Energy retained in the offline unit cannot supply the site.`
}
export const LESSONS: readonly Lesson[] = [
  {
    id: 'l1-basics',
    scenario: 'sunny',
    title: L('L1 · What is energy storage?', 'L1 · 储能是什么'),
    summary: L(
      'Capacity is tank size; power is pipe size; SOC is the fraction of energy stored.',
      '容量是水箱大小，功率是水管粗细，SOC 是储存电量占容量的比例。',
    ),
    steps: [
      {
        id: 'tank',
        minute: 720,
        focus: 'bess-cluster',
        title: L('A tank for energy', '能量水箱'),
        body: say(
          'Look at the animated tank in the storage detail card. Its water level follows the simulated stored energy. Charging fills it; discharging drains it. This is an analogy, not the physical battery structure.',
          '看看储能详情卡里的水箱：水位随仿真电量变化。充电注水，放电排水。这是类比，不是电池真实结构。',
        ),
        highlight: '.storage-tank',
      },
      {
        id: 'size',
        minute: 720,
        focus: 'bess-cluster',
        title: L('Power and capacity are different', '功率和容量不同'),
        body: (s, _d, _c, lang) =>
          lang === 'zh'
            ? `容量 ${n(s.parameters.batteryMWh)} MWh 决定能存多少；额定功率 ${n(s.parameters.batteryMW)} MW 决定每小时最多能传输多少电量。名义时长为 ${s.parameters.batteryMW ? n(s.parameters.batteryMWh / s.parameters.batteryMW) : '—'} 小时，尚未扣除 SOC 范围和效率损失。`
            : `Capacity of ${n(s.parameters.batteryMWh)} MWh sets how much can be stored; rated power of ${n(s.parameters.batteryMW)} MW sets the maximum transfer rate. Nominal duration is ${s.parameters.batteryMW ? n(s.parameters.batteryMWh / s.parameters.batteryMW) : '—'} hours, before SOC limits and efficiency losses.`,
      },
      {
        id: 'level',
        minute: 720,
        focus: 'bess-cluster',
        title: L('Read the current level', '读取当前水位'),
        body: (s, _d, _c, lang) =>
          lang === 'zh'
            ? `当前储存 ${n(s.metrics.storedMWh)} MWh，SOC ${n(s.metrics.socPct)}%。运行区间是 ${s.parameters.socMinPct}%–${s.parameters.socMaxPct}%。水箱没有放空，并不代表这些电量都可用。`
            : `Stored energy is ${n(s.metrics.storedMWh)} MWh and SOC is ${n(s.metrics.socPct)}%. The operating range is ${s.parameters.socMinPct}%–${s.parameters.socMaxPct}%. A tank that is not empty does not mean all remaining energy is available.`,
      },
    ],
  },
  {
    id: 'l2-solar',
    scenario: 'sunny',
    title: L('L2 · Capturing surplus solar', 'L2 · 光伏消纳'),
    summary: L(
      'Surplus renewable energy can charge storage, go to the grid or be curtailed when limits bind.',
      '风光富余电量可用于充电、上网，受限时也可能被弃用。',
    ),
    steps: [
      {
        id: 'sunrise',
        minute: 420,
        focus: 'pv',
        title: L('Watch the sun rise', '观察日照增强'),
        body: say(
          'Generation and demand change independently. Storage is a branch connected to the collection bus; electricity does not always pass through the battery.',
          '发电和负荷各自变化。储能是汇集母线上的双向分支，并非所有电都要经过电池。',
        ),
      },
      {
        id: 'predict',
        minute: 420,
        playFrom: 420,
        focus: 'overview',
        title: L('Predict a destination', '预测能量去向'),
        body: say(
          'Choose one destination you expect to be active after sunlight increases. Several destinations can occur together.',
          '选择日照增强后你认为会出现的一种去向；多种去向可能同时存在。',
        ),
        predict: {
          question: L('Where will surplus generation go?', '富余发电量会去哪里？'),
          revealAt: 600,
          options: [
            {
              id: 'charge',
              label: L('Into storage', '存进储能'),
              correct: (s) => s.metrics.batteryChargeMW > 0.1,
            },
            {
              id: 'export',
              label: L('Export to the grid', '送入电网'),
              correct: (s) => s.metrics.gridExportMW > 0.1,
            },
            {
              id: 'curtail',
              label: L('Curtail some generation', '弃用部分发电'),
              correct: (s) => s.metrics.curtailedMW > 0.1,
            },
          ],
          explain: flows,
        },
      },
      {
        id: 'balance',
        minute: 600,
        focus: 'bess-cluster',
        title: L('Follow all the branches', '查看各条分支'),
        body: flows,
      },
    ],
  },
  {
    id: 'l3-peak',
    scenario: 'sunny',
    title: L('L3 · The evening peak', 'L3 · 晚高峰'),
    summary: L(
      'Storage can discharge during expensive hours while preserving energy needed for peak shaving.',
      '储能可在高电价时段放电，同时为削峰保留所需能量。',
    ),
    steps: [
      {
        id: 'before',
        minute: 990,
        focus: 'bess-cluster',
        title: L('Before the peak', '高峰到来前'),
        body: say(
          'Watch the battery and grid together. The schedule protects a reserve before using remaining energy for price arbitrage.',
          '同时观察储能与电网。调度先保护削峰预留电量，再用剩余电量进行峰谷套利。',
        ),
      },
      {
        id: 'predict',
        minute: 990,
        playFrom: 990,
        focus: 'bess-cluster',
        title: L('Predict the battery direction', '预测储能方向'),
        body: say(
          'Make a prediction, then watch the timeline advance into the evening peak.',
          '先预测，再观察时间轴进入晚高峰。',
        ),
        predict: {
          question: L(
            'What will storage do at the evening checkpoint?',
            '到晚高峰观察点，储能在做什么？',
          ),
          revealAt: 1140,
          options: [
            {
              id: 'charge',
              label: L('Charge', '充电'),
              correct: (s) => s.metrics.batteryChargeMW > 0.1,
            },
            {
              id: 'discharge',
              label: L('Discharge', '放电'),
              correct: (s) => s.metrics.batteryDischargeMW > 0.1,
            },
            {
              id: 'idle',
              label: L('Stay idle', '待机'),
              correct: (s) =>
                s.metrics.batteryChargeMW <= 0.1 && s.metrics.batteryDischargeMW <= 0.1,
            },
          ],
          explain: peak,
        },
      },
      {
        id: 'shave',
        minute: 1140,
        focus: 'grid',
        highlight: '.timeline',
        title: L('A target for grid import', '购电目标水位'),
        body: peak,
      },
    ],
  },
  {
    id: 'l4-cloudy',
    scenario: 'cloudy',
    title: L('L4 · Preparing for a cloudy day', 'L4 · 阴天备战'),
    summary: L(
      'Low-price charging can prepare energy for a later shortfall, even when solar is absent.',
      '低价时段充电可为之后的供电缺口备电，即使此刻没有光伏发电。',
    ),
    steps: [
      {
        id: 'night',
        minute: 30,
        focus: 'overview',
        title: L('Plan ahead in weak weather', '为弱风少光做准备'),
        body: say(
          'The demonstration schedule knows the full day ahead. It can prepare overnight for later demand; real forecasts are less certain.',
          '演示调度预先知道全天供需，因此可以夜间备电；真实预测存在不确定性。',
        ),
      },
      {
        id: 'predict',
        minute: 30,
        playFrom: 30,
        focus: 'bess-cluster',
        title: L('Predict the charging reason', '预测充电原因'),
        body: say(
          'Follow grid import and the storage tank during the low-price window.',
          '在谷电时段同时观察购电与储能水箱。',
        ),
        predict: {
          question: L('Why charge from the grid overnight?', '为什么半夜从电网充电？'),
          revealAt: 180,
          options: [
            {
              id: 'reserve',
              label: L('Cheap energy to prepare for later demand', '利用谷电为之后的负荷备电'),
              correct: (s) => s.strategy.code === 'valley-charge',
            },
            {
              id: 'forced',
              label: L('A mandatory grid command', '电网强制指令'),
              correct: () => false,
            },
            {
              id: 'maintenance',
              label: L('Battery maintenance', '电池保养'),
              correct: () => false,
            },
          ],
          explain: reserve,
        },
      },
      {
        id: 'target',
        minute: 180,
        focus: 'bess-cluster',
        title: L('Read the charging target', '读取充电目标'),
        body: reserve,
      },
    ],
  },
  {
    id: 'l5-fault',
    scenario: 'fault',
    title: L('L5 · Losing a storage unit', 'L5 · 设备故障'),
    summary: L(
      'An offline unit reduces available power and usable energy; compare with a healthy day at the same time.',
      '离线单元会减少可用功率与可调用电量，应与同参数、同时刻的健康日对比。',
    ),
    steps: [
      {
        id: 'before',
        minute: 1020,
        focus: 'bess-4',
        title: L('Before a unit goes offline', '单元离线前'),
        body: say(
          'This lesson compares the fault day with a healthy sunny day using the same parameters and initial energy. Watch the affected storage unit.',
          '本课将故障日与同参数、同初始电量的晴天对比。观察即将受影响的储能单元。',
        ),
      },
      {
        id: 'predict',
        minute: 1020,
        playFrom: 1020,
        focus: 'bess-4',
        title: L('Predict the grid response', '预测电网响应'),
        body: say(
          'Compare imports at the same checkpoint, not two different times of day.',
          '比较两个剧本的同一时刻，而不是一天中两个不同的时刻。',
        ),
        predict: {
          question: L(
            'After BESS-04 is offline, how will grid import compare with the healthy day?',
            'BESS-04 离线后，购电与健康日相比如何变化？',
          ),
          revealAt: 1060,
          options: [
            {
              id: 'increase',
              label: L('Higher', '增加'),
              correct: (s, _d, c) =>
                s.metrics.gridImportMW - c.sunny.frames[s.minute].metrics.gridImportMW > 0.01,
            },
            {
              id: 'decrease',
              label: L('Lower', '减少'),
              correct: (s, _d, c) =>
                s.metrics.gridImportMW - c.sunny.frames[s.minute].metrics.gridImportMW < -0.01,
            },
            {
              id: 'same',
              label: L('About the same', '基本不变'),
              correct: (s, _d, c) =>
                Math.abs(s.metrics.gridImportMW - c.sunny.frames[s.minute].metrics.gridImportMW) <=
                0.01,
            },
          ],
          explain: fault,
        },
      },
      {
        id: 'impact',
        minute: 1060,
        focus: 'bess-cluster',
        title: L('Power and accessible energy', '功率和可调用电量'),
        body: fault,
      },
    ],
  },
]
export function lessonReady(
  result: StudyResult | null,
  busy: boolean,
  error: string,
  lesson: Lesson,
) {
  return (
    !!result &&
    !busy &&
    !error &&
    result.key ===
      studyKey({
        scenario: lesson.scenario,
        proposal: DEFAULT_PARAMETERS,
        original: DEFAULT_PARAMETERS,
      }) &&
    result.proposal.id === lesson.scenario &&
    (lesson.scenario !== 'fault' || result.sunny.id === 'sunny') &&
    parameterKey(result.proposal.parameters) === parameterKey(DEFAULT_PARAMETERS) &&
    parameterKey(result.sunny.parameters) === parameterKey(DEFAULT_PARAMETERS)
  )
}
