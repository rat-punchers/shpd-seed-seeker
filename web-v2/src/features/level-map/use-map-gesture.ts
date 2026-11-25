import { useCallback, useEffect, useRef, useState } from 'react'

const SETTLE_MS = 120

export function useMapGesture() {
  const [active, setActive] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const move = useCallback(() => {
    clearTimeout(timer.current)
    setActive(true)
  }, [])
  const end = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setActive(false), SETTLE_MS)
  }, [])
  return { active, move, end }
}
