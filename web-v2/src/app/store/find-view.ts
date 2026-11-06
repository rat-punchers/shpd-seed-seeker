import { CONFIG } from '../../config'
import { enumCodec, persistentStore } from '../../shared/store/persistent'

/** The two views of Find's one saved query. */
export type FindView = 'simple' | 'advanced'

export const FIND_VIEWS: readonly FindView[] = ['simple', 'advanced']

export const $findView = persistentStore<FindView>(
  CONFIG.storageKeys.findView,
  'simple',
  enumCodec(FIND_VIEWS, 'simple')
)

export function setFindView(view: FindView) {
  $findView.set(view)
}

export function isFindView(value: string): value is FindView {
  return (FIND_VIEWS as readonly string[]).includes(value)
}
