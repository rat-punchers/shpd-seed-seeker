import { ShareNetworkIcon } from '@phosphor-icons/react'
import { Button } from '@seed-seeker/design/ui/button'
import { Input } from '@seed-seeker/design/ui/input'
import { useStore } from '@tanstack/react-store'
import { CONFIG } from '../../../config'
import { AppStore } from '../../../shared/store/persistent'

const $feedback = new AppStore<
  { url: string; result: 'copied' | 'select' } | undefined
>(undefined)

async function shareSeed(code: string, url: string): Promise<void> {
  $feedback.set(undefined)
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: `Seed Seeker · ${code}`, url })
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    $feedback.set({ url, result: 'copied' })
  } catch {
    $feedback.set({ url, result: 'select' })
  }
}

export function ShareSeedButton({
  seed,
  path,
  disabled,
}: {
  seed: string
  path: string
  disabled?: boolean
}) {
  const origin = globalThis.location?.origin
  const url = new URL(
    path,
    !origin || origin === 'null' ? CONFIG.siteOrigin : origin
  ).href
  const feedback = useStore($feedback, (state) =>
    state?.url === url ? state.result : undefined
  )

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={disabled}
        onClick={() => void shareSeed(seed, url)}
        aria-label={`Share seed ${seed}`}
        title="Share seed"
      >
        <ShareNetworkIcon />
      </Button>
      {feedback === 'select' ? (
        <div className="w-full space-y-1">
          <p role="status" className="text-muted-foreground text-sm">
            Select and copy this seed link.
          </p>
          <Input
            type="url"
            aria-label="Seed share link"
            value={url}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      ) : null}
      <span
        role="status"
        className={feedback === 'copied' ? 'text-sm' : 'sr-only'}
      >
        {feedback === 'copied' ? 'Seed link copied' : ''}
      </span>
    </>
  )
}
