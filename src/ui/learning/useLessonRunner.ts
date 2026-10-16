import { useEffect, useRef, useState } from 'react'
import { DEFAULT_PARAMETERS, parameterKey } from '../../domain/parameters'
import { studyKey } from '../../data/studyProtocol'
import { LESSONS, lessonReady } from '../../learning/lessons'
import { markLessonDone } from '../../learning/progress'
import type { LessonRunnerProps } from '../../learning/lessonTypes'
type Phase = 'confirm' | 'prepare' | 'enter' | 'read' | 'play' | 'reveal' | 'summary' | 'restore'
export function useLessonRunner(props: LessonRunnerProps) {
  const api = useRef(props)
  api.current = props
  const [lessonIndex, setLessonIndex] = useState(() =>
    LESSONS.findIndex((l) => l.id === props.session.id),
  )
  const lesson = LESSONS[lessonIndex]
  const [index, setIndex] = useState(0)
  const step = lesson.steps[index]
  const [phase, setPhase] = useState<Phase>(() =>
    parameterKey(props.session.saved.proposal) === parameterKey(DEFAULT_PARAMETERS)
      ? 'prepare'
      : 'confirm',
  )
  const [choice, setChoice] = useState<string | null>(null)
  const ready = lessonReady(props.result, props.busy, props.error, lesson)
  useEffect(() => {
    if (phase === 'prepare') api.current.prepare(lesson.scenario)
    if (phase === 'restore') api.current.restore(api.current.session.saved, 'request')
  }, [phase, lesson.scenario])
  useEffect(() => {
    if (phase === 'prepare' && ready) setPhase('enter')
    if (phase === 'enter' && ready) {
      api.current.move(step.minute, step.focus ?? 'overview')
      setChoice(null)
      setPhase('read')
    }
    if (
      phase === 'play' &&
      ready &&
      step.predict &&
      !props.playing &&
      props.minute === step.predict.revealAt
    )
      setPhase('reveal')
    if (
      phase === 'restore' &&
      props.result &&
      !props.busy &&
      !props.error &&
      props.result.key === studyKey(props.session.saved)
    )
      api.current.restore(api.current.session.saved, 'finish')
  }, [
    phase,
    ready,
    step,
    props.minute,
    props.playing,
    props.result,
    props.busy,
    props.error,
    props.session.saved,
  ])
  useEffect(() => {
    if (!ready || !['read', 'reveal'].includes(phase) || !step.highlight) return
    // Tank content is lazy; observe until the actual target is mounted.
    let target: HTMLElement | null = null
    const attach = () => {
      const next = document.querySelector<HTMLElement>(step.highlight!)
      if (next === target) return
      target?.removeAttribute('data-learning-highlight')
      target = next
      target?.setAttribute('data-learning-highlight', 'true')
    }
    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      target?.removeAttribute('data-learning-highlight')
    }
  }, [ready, phase, step])
  const advance = () => {
    if (index === lesson.steps.length - 1) {
      markLessonDone(lesson.id)
      setPhase('summary')
    } else {
      setIndex(index + 1)
      setPhase('enter')
    }
  }
  const play = () => {
    if (!ready || !step.predict || !choice) return
    api.current.move(step.playFrom ?? step.minute, step.focus ?? 'overview')
    if (props.reducedMotion) {
      api.current.move(step.predict.revealAt, step.focus ?? 'overview')
      setPhase('reveal')
    } else {
      api.current.playUntil(step.predict.revealAt)
      setPhase('play')
    }
  }
  const nextLesson = () => {
    setLessonIndex(lessonIndex + 1)
    setIndex(0)
    setChoice(null)
    setPhase('prepare')
  }
  const skip = () => {
    if (ready && step.predict) {
      api.current.move(step.predict.revealAt, step.focus ?? 'overview')
      setPhase('reveal')
    }
  }
  return {
    lesson,
    index,
    step,
    phase,
    choice,
    ready,
    setChoice,
    advance,
    play,
    skip,
    nextLesson,
    hasNext: lessonIndex < LESSONS.length - 1,
    confirm: () => setPhase('prepare'),
    exit: () => setPhase('restore'),
  }
}
