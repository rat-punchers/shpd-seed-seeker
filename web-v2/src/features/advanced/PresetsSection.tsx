import { XIcon } from '@phosphor-icons/react'
import { Button } from '@seed-seeker/design/ui/button'
import { Input } from '@seed-seeker/design/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@seed-seeker/design/ui/select'
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
        <Select
          value={selected}
          onValueChange={(value) => {
            const preset = presetOf(value)
            if (preset) applyPreset(preset)
          }}
        >
          <SelectTrigger className="min-w-0 flex-1" aria-label="Load preset">
            <SelectValue placeholder="Load preset…" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Included</SelectLabel>
              {builtInPresets.map((preset, index) => (
                <SelectItem key={preset.name} value={`b:${index}`}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectGroup>
            {saved.length > 0 ? (
              <SelectGroup>
                <SelectLabel>Saved</SelectLabel>
                {saved.map((preset, index) => (
                  <SelectItem key={preset.name} value={`u:${index}`}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null}
          </SelectContent>
        </Select>
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
            <li key={preset.name} className="flex items-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-r-none"
                title="Apply preset"
                onClick={() => applyPreset(preset)}
              >
                {preset.name}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="text-muted-foreground -ml-px rounded-l-none"
                aria-label={`Delete preset ${preset.name}`}
                title="Delete preset"
                onClick={() => deletePreset(preset.name)}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
