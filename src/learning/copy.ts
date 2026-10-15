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
