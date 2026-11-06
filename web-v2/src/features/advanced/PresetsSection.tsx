import { XIcon } from '@phosphor-icons/react'
import { Button } from '@seed-seeker/design/ui/button'
import { Input } from '@seed-seeker/design/ui/input'
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from '@seed-seeker/design/ui/native-select'
import { useStore } from '@tanstack/react-store'
import { $userPresets, builtInPresets } from '../../app/store/presets'
import { $query } from '../../app/store/query'
import {
  $presetName,
  applyPreset,
  deletePreset,
  presetOf,
  saveNamedPreset,
  selectedPreset,
  toggleNaming,
} from './presets'

/** Load an included or saved preset, save the query as one, delete saved ones. */
export function PresetsSection() {
  const query = useStore($query)
  const saved = useStore($userPresets)
  const name = useStore($presetName)
  const selected = selectedPreset(query, saved)
  return (
    <section aria-labelledby="presets-heading" className="flex flex-col gap-2">
      <h3 id="presets-heading" className="text-sm font-semibold">
        Presets
      </h3>
      <div className="flex gap-2">
        <NativeSelect
          className="min-w-0 flex-1"
          aria-label="Load preset"
          value={selected}
          onChange={(event) => {
            const preset = presetOf(event.currentTarget.value)
            if (preset) applyPreset(preset)
          }}
        >
          <NativeSelectOption value="">Load preset…</NativeSelectOption>
          <NativeSelectOptGroup label="Included">
            {builtInPresets.map((preset, index) => (
              <NativeSelectOption key={preset.name} value={`b:${index}`}>
                {preset.name}
              </NativeSelectOption>
            ))}
          </NativeSelectOptGroup>
          {saved.length > 0 ? (
            <NativeSelectOptGroup label="Saved">
              {saved.map((preset, index) => (
                <NativeSelectOption key={preset.name} value={`u:${index}`}>
                  {preset.name}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
          ) : null}
        </NativeSelect>
        <Button
          type="button"
          variant="outline"
          aria-expanded={name !== null}
          onClick={toggleNaming}
        >
          Save…
        </Button>
      </div>
      {name !== null ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            className="min-w-0 flex-1"
            placeholder="Preset name"
            aria-label="Preset name"
            value={name}
            onChange={(event) => $presetName.set(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                saveNamedPreset(query)
              }
              if (event.key === 'Escape') $presetName.set(null)
            }}
          />
          <Button
            type="button"
            disabled={!name.trim()}
            onClick={() => saveNamedPreset(query)}
          >
            Save
          </Button>
        </div>
      ) : null}
      {saved.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Saved presets">
          {saved.map((preset) => (
            <li
              key={preset.name}
              className="flex items-center rounded-sm border border-border bg-card"
            >
              <button
                type="button"
                className="hover:bg-muted rounded-l-sm px-2 py-1 text-sm"
                title="Apply preset"
                onClick={() => applyPreset(preset)}
              >
                {preset.name}
              </button>
              <button
                type="button"
                className="hover:bg-muted text-muted-foreground rounded-r-sm border-l px-1.5 py-1.5"
                aria-label={`Delete preset ${preset.name}`}
                title="Delete preset"
                onClick={() => deletePreset(preset.name)}
              >
                <XIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
