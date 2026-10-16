import type { Lang } from '../domain/types'
interface HubCopy {
  title: string
  intro: string
  progress: string
  progressNote: string
  tourDescription: string
  glossary: string
  glossaryDescription: string
  flows: string
  flowsDescription: string
  completed: string
  viewed: string
  notStarted: string
  next: string
  future: string
  saved: string
  sessionOnly: string
  reset: string
  resetQuestion: string
  confirmReset: string
  cancel: string
  resetDone: string
}
export const hubCopy: Record<Lang, HubCopy> = {
  en: {
    title: 'Learning centre',
    intro: 'Understand the site, explore its vocabulary and follow the energy.',
    progress: 'Your learning activity',
    progressNote:
      'A finished tour or a viewed reference counts once. Viewing is not a knowledge assessment.',
    tourDescription: 'Take the existing step-by-step tour of the scene, timeline and controls.',
    glossary: 'Energy glossary',
    glossaryDescription: 'Search plain-language explanations in English or Chinese.',
    flows: 'View energy flows',
    flowsDescription: 'See where solar, wind, grid and stored energy go throughout the day.',
    completed: 'Completed',
    viewed: 'Viewed',
    notStarted: 'Not yet explored',
    next: 'Next in the learning edition',
    future: 'Parameter challenges will be added in the next stage.',
    saved:
      'Progress is saved in this browser. It is shared between languages, not synced to an account.',
    sessionOnly:
      'Browser storage is unavailable. Progress works for this session, but cannot be saved reliably.',
    reset: 'Reset learning progress',
    resetQuestion:
      'Clear learning activity, lesson completion and challenge results? Your simulation settings will stay as they are.',
    confirmReset: 'Clear progress',
    cancel: 'Cancel',
    resetDone: 'Learning progress cleared.',
  },
  zh: {
    title: '学习中心',
    intro: '认识园区、理解术语，再看看一天的能量去了哪里。',
    progress: '我的学习记录',
    progressNote: '完成导览或查看资料各记录一次。已查看不代表已掌握知识。',
    tourDescription: '逐步认识三维场景、时间轴和各个界面功能。',
    glossary: '能源术语表',
    glossaryDescription: '用中文或英文搜索，查看通俗的概念解释。',
    flows: '查看能量去向',
    flowsDescription: '了解一天中光伏、风电、电网和储能的供电去向。',
    completed: '已完成',
    viewed: '已查看',
    notStarted: '尚未探索',
    next: '后续学习内容',
    future: '参数挑战将在下一阶段加入。',
    saved: '进度保存在当前浏览器，中英文共用，不会同步到账号。',
    sessionOnly: '浏览器存储不可用。本次访问仍可记录进度，但无法保证刷新后保留。',
    reset: '重置学习进度',
    resetQuestion: '清除学习记录、课程完成情况和挑战成绩？当前仿真设置会保留。',
    confirmReset: '清除进度',
    cancel: '取消',
    resetDone: '学习进度已清除。',
  },
}
