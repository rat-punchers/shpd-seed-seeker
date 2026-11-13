import { ImageIcon } from '@phosphor-icons/react'
import { Button } from '@seed-seeker/design/ui/button'
import {
  Field,
  FieldDescription,
  FieldTitle,
} from '@seed-seeker/design/ui/field'
import { type ChangeEvent, useRef } from 'react'
import { ScreenshotScanDialog } from './ScreenshotScanDialog'
import { firstImageFile } from './seed-ocr/read-image'
import { scanScreenshot } from './store'
import { useScreenshotPasteDrop } from './use-screenshot-paste-drop'

/**
 * Read seed codes from a game screenshot: open one here, or paste or drop one
 * anywhere on the page while `active`.
 */
export function ScreenshotSeedSection({ active }: { active: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  useScreenshotPasteDrop(active)

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const image = firstImageFile(event.target.files)
    event.target.value = ''
    if (image) void scanScreenshot(image)
  }

  const pickScreenshot = () => fileInputRef.current?.click()

  return (
    <Field>
      <FieldTitle>Read from a screenshot</FieldTitle>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={pickScreenshot}
      >
        <ImageIcon data-icon="inline-start" />
        Open screenshot
      </Button>
      <FieldDescription>
        Open a screenshot of the hero stats window, or paste or drop one
        anywhere on the page. You choose which of the seeds found in it to
        analyze.
      </FieldDescription>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={onFileChange}
      />
      <ScreenshotScanDialog onPickAnother={pickScreenshot} />
    </Field>
  )
}
