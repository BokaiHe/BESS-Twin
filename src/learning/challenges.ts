import {
  DEFAULT_PARAMETERS,
  PARAMETER_RULES,
  normalizeParameters,
  parameterKey,
  type ParameterKey,
  type SimulationParameters,
} from '../domain/parameters'
import type { Localized, ScenarioId } from '../domain/types'
import { studyKey, type StudyResult } from '../data/studyProtocol'
import { savingsBreakdown } from '../simulation/savings'
import type { ChallengeId } from './progress'
const L = (en: string, zh: string): Localized => ({ en, zh })
export interface Criterion {
  id: string
  label: Localized
  test: (r: StudyResult) => { pass: boolean; value: string }
}
export interface Challenge {
  id: ChallengeId
  title: Localized
  scenario: ScenarioId
  start: Partial<SimulationParameters>
  editable: readonly ParameterKey[]
  criteria: readonly Criterion[]
  score: {
    key: ParameterKey | 'spread'
    better: 'lower'
    stars: readonly [number, number, number]
    unit: string
  }
  hint: Localized
  explain: Localized
}
const converged: Criterion = {
  id: 'converged',
  label: L('Periodic solution converged', '周期稳态已收敛'),
  test: (r) => ({
    pass:
      r.proposal.diagnostics.solver.status === 'converged' &&
      r.original.diagnostics.solver.status === 'converged',
    value: `${r.proposal.diagnostics.solver.residualMWh.toFixed(6)} MWh`,
  }),
}
const supply: Criterion = {
  id: 'supply',
  label: L('Unserved energy ≤ 0.001 MWh', '未供电量 ≤ 0.001 MWh'),
  test: (r) => ({
    pass: r.proposal.summary.unservedMWh <= 0.001,
    value: `${r.proposal.summary.unservedMWh.toFixed(4)} MWh`,
  }),
}
export const CHALLENGES: readonly Challenge[] = [
  {
    id: 'c1-cloudy-supply',
    title: L('C1 · Keep a cloudy day supplied', 'C1 · 阴天不缺电'),
    scenario: 'cloudy',
    start: { gridImportMW: 10 },
    editable: ['batteryMW', 'batteryMWh'],
    criteria: [converged, supply],
    score: { key: 'batteryMWh', better: 'lower', stars: [80, 40, 30], unit: 'MWh' },
    hint: L(
      'The grid import limit is fixed. Increase stored energy, then reduce capacity while keeping all demand supplied.',
      '购电上限固定。先增加电量，再尝试减小容量，同时保持全天不缺电。',
    ),
    explain: L(
      'Capacity covers the duration of a shortfall; power covers its instantaneous size. Better reliability can legitimately supply more energy than the starting design.',
      '容量要撑过缺口的持续时间，功率要补足瞬时缺口。提高可靠性后供电量可以比起始方案更多，不能因此拒绝通关。',
    ),
  },
  {
    id: 'c2-import-cap',
    title: L('C2 · Stay within the grid limit', 'C2 · 压住购电上限'),
    scenario: 'sunny',
    start: { gridImportMW: 8, batteryMW: 4 },
    editable: ['batteryMW', 'batteryMWh'],
    criteria: [
      converged,
      supply,
      {
        id: 'import',
        label: L('Maximum import ≤ 8 MW', '最大购电 ≤ 8 MW'),
        test: (r) => {
          const v = Math.max(...r.proposal.frames.map((f) => f.metrics.gridImportMW))
          return { pass: v <= 8 + 1e-6, value: `${v.toFixed(3)} MW` }
        },
      },
    ],
    score: { key: 'batteryMW', better: 'lower', stars: [20, 10, 8], unit: 'MW' },
    hint: L(
      'A larger tank alone will not fix a narrow pipe. Try enough power and energy, then reduce rated power.',
      '只有大水箱还不够，水管不能太细。先配足功率与电量，再尝试降低额定功率。',
    ),
    explain: L(
      'The battery must cover demand above the import limit. Extra capacity cannot compensate for insufficient instantaneous discharge power.',
      '超过购电上限的负荷需要储能补足。增加容量不能弥补瞬时放电功率不足。',
    ),
  },
  {
    id: 'c3-spread',
    title: L('C3 · Explore the tariff spread', 'C3 · 峰谷价差'),
    scenario: 'sunny',
    start: {},
    editable: ['valleyPrice', 'flatPrice', 'peakPrice'],
    criteria: [
      converged,
      {
        id: 'tariff',
        label: L(
          'Valley ≤ 0.35, mid ≤ 0.68; valley ≤ mid ≤ peak (CNY/kWh)',
          '谷价 ≤ 0.35，平价 ≤ 0.68，且谷 ≤ 平 ≤ 峰（CNY/kWh）',
        ),
        test: (r) => {
          const p = r.proposal.parameters
          return {
            pass:
              p.valleyPrice <= 0.35 &&
              p.flatPrice <= 0.68 &&
              p.valleyPrice <= p.flatPrice &&
              p.flatPrice <= p.peakPrice,
            value: `${p.valleyPrice.toFixed(2)} / ${p.flatPrice.toFixed(2)} / ${p.peakPrice.toFixed(2)} CNY/kWh`,
          }
        },
      },
      {
        id: 'savings',
        label: L('Comparable daily storage savings ≥ 15,000 CNY', '全天可比储能节省 ≥ 15,000 CNY'),
        test: (r) => {
          const v = savingsBreakdown(r.proposal, 1440).estimatedSavingsCny
          return { pass: v !== null && v >= 15000, value: v === null ? '—' : `${v.toFixed(2)} CNY` }
        },
      },
    ],
    score: { key: 'spread', better: 'lower', stars: [3, 1.3, 1.05], unit: 'CNY/kWh' },
    hint: L(
      'Keep valley and mid prices at or below their starting levels. Savings use a no-storage baseline at your new tariffs, not the old design bill.',
      '谷价和平价不高于起始值。节省与新电价下的无储能方案比较，不与旧电价账单相减。',
    ),
    explain: L(
      'Higher peak prices increase the value of discharging. On this sunny day, charging mainly absorbs solar, so lowering the valley price may have little effect. The tariff limits prevent raising every price to bypass the spread challenge.',
      '峰价提高会增加高峰放电的价值。这一晴天主要用富余光伏充电，降低谷价未必明显增加节省。电价边界防止通过整体抬价绕过价差挑战。',
    ),
  },
  {
    id: 'c4-curtailment',
    title: L('C4 · Capture excess renewables', 'C4 · 风光过剩'),
    scenario: 'sunny',
    start: { pvDCMWp: 40, windMW: 24, gridExportMW: 0 },
    editable: ['batteryMW', 'batteryMWh'],
    criteria: [
      converged,
      supply,
      {
        id: 'curtailment',
        label: L('Network curtailment ≤ 135 MWh', '网络弃风弃光 ≤ 135 MWh'),
        test: (r) => ({
          pass: r.proposal.summary.curtailedMWh <= 135,
          value: `${r.proposal.summary.curtailedMWh.toFixed(3)} MWh`,
        }),
      },
    ],
    score: { key: 'batteryMWh', better: 'lower', stars: [80, 50, 35], unit: 'MWh' },
    hint: L(
      'Export is blocked. Increase storage to capture surplus generation. AC clipping is separate and does not count toward this target.',
      '禁止上网。增加储能来吸收富余发电。光伏交流侧削顶单独统计，不计入本关弃电目标。',
    ),
    explain: L(
      'Storage reduces curtailment, but it cannot eliminate a persistent daily surplus. Once later demand is covered, extra capacity has diminishing value.',
      '储能能减少弃电，但无法消除持续的全天能量过剩。后续负荷已被满足时，继续加容量的收益会下降。',
    ),
  },
]
export function challengeStart(c: Challenge): SimulationParameters {
  return normalizeParameters({ ...DEFAULT_PARAMETERS, ...c.start })
}
/** Enforce locks at the data boundary as well as on the controls. */
export function challengeProposal(c: Challenge, input: SimulationParameters): SimulationParameters {
  const p = { ...challengeStart(c) }
  for (const key of c.editable) p[key] = input[key]
  return normalizeParameters(p)
}
export function challengeScore(c: Challenge, p: SimulationParameters) {
  return c.score.key === 'spread'
    ? Number((p.peakPrice - p.valleyPrice).toFixed(6))
    : p[c.score.key]
}
export function evaluateChallenge(c: Challenge, r: StudyResult) {
  const criteria = c.criteria.map((rule) => ({ ...rule, ...rule.test(r) }))
  const integrity =
    r.proposal.id === c.scenario &&
    r.original.id === c.scenario &&
    parameterKey(r.original.parameters) === parameterKey(challengeStart(c)) &&
    parameterKey(challengeProposal(c, r.proposal.parameters)) ===
      parameterKey(r.proposal.parameters)
  const pass = integrity && criteria.every((x) => x.pass)
  const score = challengeScore(c, r.proposal.parameters)
  const stars = (pass ? c.score.stars.filter((limit) => score <= limit + 1e-9).length : 0) as
    0 | 1 | 2 | 3
  return { criteria, pass, score, stars }
}
export function challengeReady(
  c: Challenge,
  proposal: SimulationParameters,
  r: StudyResult | null,
  busy: boolean,
  error: string,
) {
  return (
    !!r &&
    !busy &&
    !error &&
    r.key ===
      studyKey({
        scenario: c.scenario,
        original: challengeStart(c),
        proposal: challengeProposal(c, proposal),
      }) &&
    parameterKey(r.proposal.parameters) === parameterKey(proposal) &&
    r.proposal.id === c.scenario &&
    parameterKey(r.original.parameters) === parameterKey(challengeStart(c))
  )
}
export const challengeParameterKeys = Object.keys(PARAMETER_RULES) as ParameterKey[]
