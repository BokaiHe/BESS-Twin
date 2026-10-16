import type { Lang } from '../domain/types'
import type { ExplorerMode } from './explorerState'
interface Copy {
  snapshot: string
  live: string
  fixed: string
  schematic: string
  speedNote: string
  following: string
  manual: string
  follow: string
  output: string
  rating: string
  hours: string
  states: Record<ExplorerMode, string>
}
export const explorerCopy: Record<Lang, Copy> = {
  en: {
    snapshot: 'Simulation snapshot',
    live: 'Data snapshot',
    fixed:
      'State is fixed at opening time. Close and reopen after moving the timeline to see another moment.',
    schematic: 'Schematic speed',
    speedNote:
      'Animation rate follows output ÷ configured rating. It is not measured RPM or wind speed; visual controls do not change the simulation.',
    following: 'Following snapshot',
    manual: 'Manual teaching animation · snapshot unchanged',
    follow: 'Follow snapshot',
    output: 'Power',
    rating: 'Rated power',
    hours: 'hours',
    states: {
      generating: 'Generating',
      charge: 'Charging',
      discharge: 'Discharging',
      idle: 'Idle · no net flow',
      offline: 'Offline · no flow',
      unavailable: 'Data unavailable · animation stopped',
    },
  },
  zh: {
    snapshot: '仿真快照',
    live: '数据快照',
    fixed: '状态固定在打开时刻。关闭后调整时间轴，再次打开可查看其他时刻。',
    schematic: '示意转速',
    speedNote:
      '动画倍率按出力 ÷ 当前配置的额定功率计算，不是实测转速或风速；动画操作不会改变仿真。',
    following: '跟随快照',
    manual: '手动教学动画 · 不改变快照',
    follow: '跟随快照',
    output: '功率',
    rating: '额定功率',
    hours: '小时',
    states: {
      generating: '发电',
      charge: '充电',
      discharge: '放电',
      idle: '待机 · 无净流动',
      offline: '离线 · 无流动',
      unavailable: '数据不可用 · 动画停止',
    },
  },
}
