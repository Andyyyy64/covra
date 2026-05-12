import { test, expect } from './covra.fixture'

test('home page executes browser and server code', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Covra fixture' })).toBeVisible()
  await expect(page.getByTestId('server-greeting')).toHaveText('Hello, Covra')
  await expect(page.getByTestId('client-label')).toHaveText('idle')

  await page.getByRole('button', { name: 'Count 0' }).click()
  await expect(page.getByTestId('client-label')).toHaveText('clicked')

  const response = await page.request.get('/api/health')
  expect(response.ok()).toBe(true)
  await expect(response).toBeOK()
})
