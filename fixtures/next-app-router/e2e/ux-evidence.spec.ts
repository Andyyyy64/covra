import { expect, test } from './covra.fixture'

test('ux evidence page records modal, validation, collection, and api evidence', async ({ page }) => {
  await page.goto('/ux-evidence')

  await expect(page.getByRole('heading', { name: 'UX evidence fixture' })).toBeVisible()

  await page.getByRole('button', { name: 'Open billing modal' }).click()
  await expect(page.getByRole('dialog', { name: 'Billing modal' })).toBeVisible()

  await page.getByRole('button', { name: 'Submit billing form' }).click()
  await expect(page.getByText('Email is required')).toBeVisible()

  await page.getByRole('button', { name: 'Show review checklist' }).click()
  await expect(page.getByTestId('review-checklist')).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(100)

  await page.getByRole('button', { name: 'Load demo API' }).click()
  await expect(page.getByTestId('api-result')).toHaveText('ok')
})
