import { ArrowRightIcon, CheckIcon, CopyIcon } from '@phosphor-icons/react'
import { Button } from '@seed-seeker/design/ui/button'
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@seed-seeker/design/ui/card'
import { useState } from 'react'
import type { ParsedSeed } from '../../engine/types'
import { getItem } from '../../shared/game/catalog'
import { itemArt } from '../../shared/sprites/sprites'
import { ItemSprite } from '../../shared/ui/ItemSprite'
import { analyzeMatch } from './run'

/** One matching seed: its code, the trinket the search chose, and Analyze. */
export function ResultCard({
  match,
  index,
}: {
  match: ParsedSeed
  index: number
}) {
  const [copied, setCopied] = useState(false)
  const trinket = match.selectedTrinket
    ? getItem(match.selectedTrinket)
    : undefined

  function copy() {
    void navigator.clipboard?.writeText(match.code).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1_200)
    })
  }

  return (
    <Card size="sm" data-testid="result-card">
      <CardHeader>
        <CardTitle>
          <h3 className="font-mono text-base">{match.code}</h3>
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <span>Result {index + 1}</span>
          {trinket ? (
            <span className="flex items-center gap-1">
              <ItemSprite art={itemArt(trinket.sprite)} size={16} />
              {trinket.name}
            </span>
          ) : match.selectedTrinket === null ? (
            <span>No trinket</span>
          ) : null}
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Copy seed ${match.code}`}
            title="Copy seed"
            onClick={copy}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
        </CardAction>
      </CardHeader>
      <CardFooter className="justify-end pb-3.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => analyzeMatch(match)}
        >
          Analyze seed
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  )
}
