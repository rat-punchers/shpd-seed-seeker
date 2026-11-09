import { MagnifyingGlassIcon, PlantIcon } from '@phosphor-icons/react'
import { Button } from '@seed-seeker/design/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@seed-seeker/design/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@seed-seeker/design/ui/input-group'
import { useStore } from '@tanstack/react-store'
import {
  type ChangeEvent,
  type FormEvent,
  useLayoutEffect,
  useRef,
} from 'react'
import { formatSeedCode } from '../../engine/wasm'
import {
  $seedFormatterReady,
  caretAfterSignificant,
  isCompleteSeedInput,
  loadSeedFormatter,
  mayCompleteSeedInput,
  significantCountBefore,
} from './seed-input'
import { $seedInput, MAX_OPEN_SEEDS, openSeed } from './sessions'

function load() {
  void loadSeedFormatter().catch(() => undefined)
}

function submit(seed: string) {
  if (!isCompleteSeedInput(seed)) return
  $seedInput.set('')
  void openSeed({ seed })
}

/** The sidebar's seed field: formats as you type and opens the seed in a tab. */
export function SeedForm() {
  const seedInput = useStore($seedInput)
  const ready = useStore($seedFormatterReady)
  const inputRef = useRef<HTMLInputElement>(null)
  // Significant characters before the caret, so it survives the regrouping
  // when the engine loads mid-typing.
  const caretRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const input = inputRef.current
    const count = caretRef.current
    if (!input || count == null || input.value !== seedInput) return
    const caret = caretAfterSignificant(seedInput, count)
    input.setSelectionRange(caret, caret)
  }, [seedInput])

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    load()
    const raw = event.target.value
    const cursor = event.target.selectionStart ?? raw.length
    // Until the engine loads, keep the text as typed; it formats on load.
    const formatted = ready ? formatSeedCode(raw) : raw.toUpperCase()
    caretRef.current = significantCountBefore(raw, cursor)
    if (formatted === seedInput) {
      const caret = caretAfterSignificant(formatted, caretRef.current)
      event.target.value = formatted
      event.target.setSelectionRange(caret, caret)
      return
    }
    $seedInput.set(formatted)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (ready) return submit(formatSeedCode(seedInput))
    void loadSeedFormatter().then(
      () => submit($seedInput.get()),
      () => submit(seedInput)
    )
  }

  const complete = ready
    ? isCompleteSeedInput(seedInput)
    : mayCompleteSeedInput(seedInput)
  return (
    <form onSubmit={onSubmit} aria-label="Analyze a seed">
      <FieldGroup className="gap-2">
        <Field>
          <FieldLabel htmlFor="seed">Enter your seed</FieldLabel>
          <div className="flex w-full items-stretch">
            <InputGroup className="min-w-0 flex-1 rounded-r-none border-r-0">
              <InputGroupAddon align="inline-start" aria-hidden>
                <PlantIcon />
              </InputGroupAddon>
              <InputGroupInput
                ref={inputRef}
                id="seed"
                value={seedInput}
                onChange={onChange}
                onFocus={load}
                onPointerDown={load}
                placeholder="XXX-XXX-XXX or YYYY-MM-DD"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={ready ? 11 : undefined}
                aria-invalid={
                  seedInput.length >= 10 && !complete ? true : undefined
                }
                className="font-mono placeholder:font-sans"
              />
            </InputGroup>
            <Button
              type="submit"
              size="icon"
              className="rounded-l-none"
              aria-label="Analyze"
              disabled={!complete}
            >
              <MagnifyingGlassIcon />
            </Button>
          </div>
          <FieldDescription>
            Seed codes are ABC-DEF-GHI. Daily runs are YYYY-MM-DD. Up to{' '}
            {MAX_OPEN_SEEDS} open seeds are kept (oldest dropped).
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
