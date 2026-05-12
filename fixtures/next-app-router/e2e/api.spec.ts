import { expect, test } from './covra.fixture'

test('health route executes server-only code in a parallel worker', async ({ page }) => {
  await page.goto('/')
  const payload = await page.evaluate(async () => {
    const response = await fetch('/api/health')
    return await response.json() as { ok: boolean }
  })

  expect(payload.ok).toBe(true)
})
