import type { Locator, Page } from '@playwright/test'

/** Opens a select (`trigger`, a combobox) and picks the option named `name`. */
export async function selectOption(
  page: Page,
  trigger: Locator,
  name: string
): Promise<void> {
  await trigger.click()
  await page.getByRole('option', { name, exact: true }).click()
}

/** Loads a preset by name from the Presets picker. */
export const loadPreset = (page: Page, name: string): Promise<void> =>
  selectOption(page, page.getByLabel('Load preset'), name)

/** The heading button that opens or closes a collapsible section. */
export const sectionToggle = (page: Page, name: string): Locator =>
  page
    .getByRole('region', { name, exact: true })
    .locator('[data-slot="collapsible-trigger"]')
