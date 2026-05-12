import { test as base, expect } from '@playwright/test'
import { covraFixture } from '../../../dist/playwright.js'

const fixtureRoot = new URL('..', import.meta.url).pathname

export const test = base.extend({
  ...covraFixture({ cwd: fixtureRoot }),
})

export { covraMark } from '../../../dist/playwright.js'
export { expect }
