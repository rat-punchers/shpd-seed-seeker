import { useEffect, useState } from 'react'

/**
 * The current frame of a looping sprite film. Holds the first frame with
 * reduced motion or a single frame.
 */
export function useFilmFrame(frameCount: number, frameDurationMs: number) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    setFrame(0)
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (frameCount < 2 || motion.matches) return
    const timer = window.setInterval(
      () => setFrame((current) => (current + 1) % frameCount),
      Math.max(16, frameDurationMs)
    )
    return () => window.clearInterval(timer)
  }, [frameCount, frameDurationMs])
  return frame
}
