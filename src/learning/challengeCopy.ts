import type { Lang } from '../domain/types'
interface Copy {
  title: string
  intro: string
  start: string
  goals: string
  waiting: string
  passed: string
  pending: string
  success: string
  score: string
  best: string
  rating: string
  next: string
  exit: string
  restoring: string
  locked: string
  hint: string
  retry: string
  reference: string
  sessionOnly: string
  progress: string
}
export const challengeCopy: Record<Lang, Copy> = {
  en: {
    title: 'Parameter challenges',
    intro:
      'Solve a design problem, then try a smaller solution. Your free-mode settings will be restored on exit.',
    start: 'Start challenge',
    goals: 'Pass every goal',
    waiting: 'Computing your latest design…',
    passed: 'Passed',
    pending: 'Not yet',
    success: 'Challenge complete',
    score: 'Current score',
    best: 'Personal best',
    rating: 'Stars for a passing design (lower is better)',
    next: 'Next challenge',
    exit: 'Exit challenge',
    restoring: 'Restoring your simulation…',
    locked: 'Locked for this challenge',
    hint: 'Hint',
    retry: 'Retry calculation',
    reference:
      'The original is fixed to the starting design. Challenge goals use full-day results; bill differences between designs are not the savings score.',
    sessionOnly:
      'Browser storage is unavailable. Your best result is retained for this session only.',
    progress: 'Challenges completed',
  },
  zh: {
    title: '参数挑战',
    intro: '解决一个配置问题，再尝试更小的方案。退出时恢复自由探索的设置。',
    start: '开始挑战',
    goals: '满足全部目标即可通关',
    waiting: '正在计算最新方案…',
    passed: '已通过',
    pending: '未通过',
    success: '挑战完成',
    score: '当前得分',
    best: '个人最佳',
    rating: '通关方案的星级（越小越好）',
    next: '下一关',
    exit: '退出挑战',
    restoring: '正在恢复原来的仿真…',
    locked: '本关锁定',
    hint: '提示',
    retry: '重新计算',
    reference: '原方案固定为关卡起点。目标按全天结果判定，两方案账单差额不作为储能节省得分。',
    sessionOnly: '浏览器存储不可用，最佳成绩仅保留在本次会话。',
    progress: '已完成挑战',
  },
}
