import { expect, type Page } from '@playwright/test'

/** Simple row `number`'s item picker: a dropdown, a dialog on phones. */
export const itemPicker = (page: Page, number: number) =>
  page.getByLabel(`Item ${number}`, { exact: true })

/**
 * Edits Simple row `number` through its picker: searches for and picks
 * `item` (an option's visible name), then sets the upgrade and floor in the
 * menu's footer, and closes it with Done.
 */
export async function editItem(
  page: Page,
  number: number,
  edit: { item?: string; upgrade?: number; floor?: number }
): Promise<void> {
  await itemPicker(page, number).click()
  const search = page.getByLabel(`Search item ${number}`)
  if (edit.item) {
    await search.fill(edit.item)
    await page.getByRole('option', { name: edit.item, exact: true }).click()
  }
  if (edit.upgrade !== undefined)
    await page
      .getByRole('radio', { name: `At least +${edit.upgrade}`, exact: true })
      .click()
  if (edit.floor !== undefined)
    await page
      .getByRole('radio', { name: `By floor ${edit.floor}`, exact: true })
      .click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(search).toBeHidden()
}
