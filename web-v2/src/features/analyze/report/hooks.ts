import { useEffect, useLayoutEffect, useState } from 'react'

/**
 * Publishes an element's height as a CSS custom property on `<html>`, so
 * sticky layers below it can offset themselves. Removed while `active` is
 * false or on unmount.
 */
export function usePublishedHeight(
  ref: { current: HTMLElement | null },
  property: `--${string}`,
  active: boolean
) {
  useLayoutEffect(() => {
    const root = document.documentElement
    const element = ref.current
    if (!active || !element) {
      root.style.removeProperty(property)
      return
    }
    const publish = () => {
      root.style.setProperty(property, `${element.offsetHeight}px`)
    }
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(element)
    return () => {
      observer.disconnect()
      root.style.removeProperty(property)
    }
  }, [ref, property, active])
}

/** Viewport y of a sticky element's bottom once it is stuck. */
export function stuckBottom(element: HTMLElement | null): number {
  if (!element) return 0
  return (
    (Number.parseFloat(getComputedStyle(element).top) || 0) +
    element.offsetHeight
  )
}

/**
 * The floor being read: the last `[data-floor-depth]` section in
 * `container` whose top has reached the stuck bottom of `anchor`. Null
 * above the first floor.
 */
export function useCurrentFloor(
  container: { current: HTMLElement | null },
  anchor: { current: HTMLElement | null }
): number | null {
  const [depth, setDepth] = useState<number | null>(null)

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const root = container.current
      if (!root) return
      const line = stuckBottom(anchor.current) + 1
      let current: number | null = null
      for (const section of root.querySelectorAll<HTMLElement>(
        '[data-floor-depth]'
      )) {
        if (section.getBoundingClientRect().top > line) break
        current = Number(section.dataset.floorDepth)
      }
      setDepth(current)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [container, anchor])

  return depth
}

/** True when the user asked for less motion. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
