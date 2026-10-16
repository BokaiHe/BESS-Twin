import type { Lang } from '../domain/types'
interface LessonCopy {
  lessons: string
  duration: string
  completed: string
  start: string
  preparing: string
  restoring: string
  confirm: string
  accept: string
  exit: string
  cancel: string
  next: string
  finish: string
  nextLesson: string
  summary: string
  predict: string
  play: string
  skip: string
  observe: string
  matched: string
  missed: string
  none: string
  actual: string
  chosen: string
  retry: string
  lock: string
  step: string
  ready: string
  reveal: string
  source: string
}
export const lessonCopy: Record<Lang, LessonCopy> = {
  en: {
    lessons: 'Guided lessons',
    duration: 'About 2–3 minutes · self-paced',
    completed: 'Completed',
    start: 'Start lesson',
    preparing: 'Preparing lesson data…',
    restoring: 'Restoring your simulation…',
    confirm:
      'This lesson uses default parameters. Your original and proposed designs, scenario, time and camera will be restored when you finish or exit.',
    accept: 'Use defaults and start',
    exit: 'Exit lesson',
    cancel: 'Cancel',
    next: 'Next',
    finish: 'Finish and restore',
    nextLesson: 'Next lesson',
    summary: 'What you learned',
    predict: 'Predict first',
    play: 'Play and reveal',
    skip: 'Skip playback and reveal',
    observe: 'Watch the scene and timeline…',
    matched: 'Your prediction matches the data.',
    missed: 'A different outcome — let’s look at the data.',
    none: 'Different behavior under these parameters. See the measured results below.',
    actual: 'Observed outcomes',
    chosen: 'Your prediction',
    retry: 'Retry calculation',
    lock: 'The lesson controls parameters and time. Exit to explore freely.',
    step: 'Step',
    ready: 'Choose one prediction to continue.',
    reveal: 'Result',
    source: 'Lessons need the built-in simulation.',
  },
  zh: {
    lessons: '引导课程',
    duration: '约 2–3 分钟 · 按自己的节奏学习',
    completed: '已完成',
    start: '开始课程',
    preparing: '正在准备课程数据…',
    restoring: '正在恢复原来的仿真…',
    confirm: '课程使用默认参数。你的原方案、新方案、情景、时刻和镜头会先保存，完成或退出时恢复。',
    accept: '使用默认参数开始',
    exit: '退出课程',
    cancel: '取消',
    next: '下一步',
    finish: '完成并恢复',
    nextLesson: '下一课',
    summary: '你学到了',
    predict: '先预测',
    play: '播放并揭晓',
    skip: '跳过播放并揭晓',
    observe: '观察场景和时间轴…',
    matched: '你的预测与数据一致。',
    missed: '结果与你的预测不同，来看看数据。',
    none: '这些参数下出现了不同表现，请查看下方实测结果。',
    actual: '观察到的结果',
    chosen: '你的预测',
    retry: '重新计算',
    lock: '课程暂时接管参数和时间，退出后可自由探索。',
    step: '步骤',
    ready: '选择一个预测后继续。',
    reveal: '揭晓结果',
    source: '课程需要内置仿真数据。',
  },
}
