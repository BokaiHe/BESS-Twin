import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const family = (view: string) => (view === 'cell' ? 'cell' : 'assembly')

// Keep the outgoing live scene until it has faded; cancel stale navigation on a new request.
export function useSceneTransition(view: string, reduced: boolean) {
  const scene = useRef<HTMLDivElement>(null)
  const motion = useRef<Animation | null>(null)
  const pending = useRef<(() => void) | null>(null)
  const entering = useRef(false)
  const generation = useRef(0)
  const [moving, setMoving] = useState(false)
  const cancel = () => {
    generation.current++
    motion.current?.cancel()
    motion.current = null
  }
  const run = (next: string, commit: () => void) => {
    const node = scene.current
    const opacity = node ? getComputedStyle(node).opacity : '1'
    cancel()
    pending.current = null
    entering.current = false
    if (reduced || !node || family(next) === family(view)) {
      setMoving(false)
      commit()
      return
    }
    setMoving(true)
    pending.current = commit
    const token = generation.current
    motion.current = node.animate(
      [
        { opacity, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(.985)' },
      ],
      { duration: 180, easing: 'ease-in', fill: 'forwards' },
    )
    void motion.current.finished
      .then(() => {
        if (generation.current !== token) return
        pending.current = null
        entering.current = true
        commit()
      })
      .catch(() => {})
  }
  useLayoutEffect(() => {
    if (!entering.current || !scene.current) return
    entering.current = false
    cancel()
    if (reduced) {
      setMoving(false)
      return
    }
    const token = generation.current
    const animation = scene.current.animate(
      [
        { opacity: 0, transform: 'scale(1.015)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: 360, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' },
    )
    motion.current = animation
    void animation.finished
      .then(() => {
        if (generation.current !== token) return
        animation.cancel()
        motion.current = null
        setMoving(false)
      })
      .catch(() => {})
  }, [view, reduced])
  useEffect(() => {
    if (!reduced) return
    const commit = pending.current
    pending.current = null
    entering.current = false
    cancel()
    commit?.()
    setMoving(false)
  }, [reduced])
  useEffect(
    () => () => {
      cancel()
      pending.current = null
    },
    [],
  )
  return { scene, moving, run }
}
