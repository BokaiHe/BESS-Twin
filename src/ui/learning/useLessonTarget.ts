import { useEffect } from 'react'

/** Reveal a lazy lesson target after layout, without following the user's scrolling. */
export function useLessonTarget(selector: string | undefined, layoutKey: string) {
  useEffect(() => {
    if (!selector) return
    let target: HTMLElement | null = null
    let frame = 0
    let settleFrame = 0
    const panel = document.querySelector<HTMLElement>('.lesson-runner')
    const reveal = () => {
      if (!target?.isConnected || !panel?.isConnected) return
      const bounds = target.getBoundingClientRect()
      const obstacle = panel.getBoundingClientRect()
      const overlaps = bounds.left < obstacle.right && bounds.right > obstacle.left
      const bottom =
        getComputedStyle(panel).position === 'fixed' && overlaps
          ? obstacle.top - 12
          : window.innerHeight - 12
      // Very short phones retain an independently scrollable tank, rather than hiding its controls.
      let availableHeight = bottom - 12
      for (let parent = target.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent)
        if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
          availableHeight = Math.min(
            availableHeight,
            parent.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
          )
        }
      }
      target.style.setProperty('--lesson-target-height', `${Math.max(80, availableHeight)}px`)
      target.setAttribute('data-lesson-target', 'true')
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
      const visible = target.getBoundingClientRect()
      if (visible.top < 12 || visible.bottom > bottom) {
        const top = Math.max(12, (bottom + 12 - visible.height) / 2)
        window.scrollBy({ top: visible.top - top, behavior: 'instant' })
      }
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(settleFrame)
      frame = requestAnimationFrame(() => {
        settleFrame = requestAnimationFrame(reveal)
      })
    }
    const resize = new ResizeObserver(schedule)
    if (panel) resize.observe(panel)
    const clear = () => {
      target?.removeAttribute('data-lesson-target')
      target?.style.removeProperty('--lesson-target-height')
    }
    const attach = () => {
      const next = document.querySelector<HTMLElement>(selector)
      if (next === target) return
      if (target) resize.unobserve(target)
      clear()
      target = next
      if (target) resize.observe(target)
      schedule()
    }
    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', schedule)
    return () => {
      observer.disconnect()
      resize.disconnect()
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(frame)
      cancelAnimationFrame(settleFrame)
      clear()
    }
  }, [selector, layoutKey])
}
