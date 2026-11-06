import { useStore } from '@tanstack/react-store'
import {
  $workerCount,
  maxWorkers,
  setWorkerCount,
} from '../../../app/store/query'
import { SliderRow } from '../sheet/controls'
import { SettingCaption, SettingsDetails } from './parts'

/** How many search workers to spawn; absent on a single-core device. */
export function Performance() {
  const count = useStore($workerCount)
  const ceiling = maxWorkers()
  if (ceiling <= 1) return null
  return (
    <SettingsDetails title="Performance">
      <SliderRow
        label="Workers"
        valueLabel={`${Math.min(count, ceiling)} of ${ceiling} cores`}
        min={1}
        max={ceiling}
        value={Math.min(count, ceiling)}
        onChange={setWorkerCount}
      />
      <SettingCaption>Number of search threads to spawn.</SettingCaption>
    </SettingsDetails>
  )
}
