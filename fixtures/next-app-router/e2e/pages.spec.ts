import { expect, test, covraMark } from './covra.fixture'

test('pages router executes browser, ssr, and api code', async ({ page }, testInfo) => {
  covraMark(testInfo, { route: '/legacy', state: 'ssr.loaded' })
  await page.goto('/legacy')

  await expect(page.getByRole('heading', { name: 'Pages Router fixture' })).toBeVisible()
  await expect(page.getByTestId('pages-greeting')).toHaveText('Pages hello, Covra')

  covraMark(testInfo, { route: '/legacy', state: 'modal-or-state.clicked' })
  await page.getByRole('button', { name: 'Legacy idle' }).click()
  await expect(page.getByRole('button', { name: 'Legacy clicked' })).toBeVisible()

  covraMark(testInfo, { route: '/api/legacy', state: 'api.success' })
  const payload = await page.evaluate(async () => {
    const response = await fetch('/api/legacy')
    return await response.json() as { ok: boolean; greeting: string }
  })

  expect(payload).toEqual({
    ok: true,
    greeting: 'Pages hello, API',
  })
})
