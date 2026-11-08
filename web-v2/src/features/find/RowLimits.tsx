import { tierClass } from '@seed-seeker/design/spd/item-slot'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@seed-seeker/design/ui/toggle-group'
import { FLOOR_LIMIT_OPTIONS } from '../query/query'

const LIMIT_ITEM = 'h-7 min-w-0 px-0 text-xs tabular-nums'

/**
 * The item picker's footer: the minimum upgrade (when the item has one) and
 * the floor the item must be found by.
 */
export function RowLimits({
  number,
  levels,
  minUpgrade,
  depth,
  onUpgrade,
  onDepth,
}: {
  number: number
  levels: number[]
  minUpgrade: number | undefined
  depth: number
  onUpgrade: (minUpgrade: number | undefined) => void
  onDepth: (depth: number) => void
}) {
  return (
    <div className="flex flex-col gap-3 border-t p-2.5">
      {levels.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-semibold">
            Minimum upgrade
          </span>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={1}
            value={minUpgrade === undefined ? 'any' : String(minUpgrade)}
            onValueChange={(value) => {
              if (value) onUpgrade(value === 'any' ? undefined : Number(value))
            }}
            aria-label={`Item ${number} upgrade level`}
            className="grid w-full"
            style={{
              gridTemplateColumns: `repeat(${levels.length + 1}, minmax(0, 1fr))`,
            }}
          >
            <ToggleGroupItem value="any" className={LIMIT_ITEM}>
              Any
            </ToggleGroupItem>
            {levels.map((level) => (
              <ToggleGroupItem
                key={level}
                value={String(level)}
                aria-label={`At least +${level}`}
                className={LIMIT_ITEM}
              >
                <span className={tierClass(level)}>+{level}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-xs font-semibold">
          Found by floor
        </span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={1}
          value={String(depth)}
          onValueChange={(value) => {
            if (value) onDepth(Number(value))
          }}
          aria-label={`Item ${number} floor`}
          className="grid w-full grid-cols-7"
        >
          {FLOOR_LIMIT_OPTIONS.map((floor) => (
            <ToggleGroupItem
              key={floor}
              value={String(floor)}
              aria-label={`By floor ${floor}`}
              className={LIMIT_ITEM}
            >
              {floor}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  )
}
