import { useStore } from '@tanstack/react-store'
import { $query } from '../../../app/store/query'
import { FLOOR_LIMIT_OPTIONS } from '../../query/query'
import { SliderRow } from '../sheet/controls'
import { patchQuery } from './edit'
import { SettingCaption, SettingSwitch } from './parts'

/** The floor limit and AutoTrinket, always open. */
export function SearchScope() {
  const maxDepth = useStore($query, (query) => query.maxDepth)
  const autoApply = useStore($query, (query) => query.autoApplyTrinket)
  const explicit = useStore($query, (query) =>
    query.requirements.some((requirement) => requirement.selectTrinket)
  )
  return (
    <section
      aria-labelledby="search-scope-heading"
      className="flex flex-col gap-3"
    >
      <h3 id="search-scope-heading" className="text-sm font-semibold">
        Search scope
      </h3>
      <SliderRow
        label="Floor limit"
        valueLabel={`first ${maxDepth} floor${maxDepth === 1 ? '' : 's'}`}
        values={FLOOR_LIMIT_OPTIONS}
        value={maxDepth}
        onChange={(value) => patchQuery({ maxDepth: value })}
      />
      <div className="flex flex-col gap-1">
        <SettingSwitch
          label="AutoTrinket"
          checked={autoApply}
          disabled={explicit}
          onChange={(value) => patchQuery({ autoApplyTrinket: value })}
        />
        <SettingCaption>
          {explicit
            ? 'Uses your explicit trinket selection instead.'
            : 'Applies a helpful trinket at +3 at the first brewing opportunity. Keeps it only when the match needs it.'}
        </SettingCaption>
      </div>
    </section>
  )
}
