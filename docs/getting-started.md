# Getting Started

This guide sets up Covra for a production-style Next.js + Playwright project and produces a route-first E2E UX coverage dashboard.

## Requirements

- Node.js 20 or newer
- Next.js running on the Node runtime
- `@playwright/test`
- a Chromium Playwright project for coverage
- a production build command that can emit webpack source maps

Install:

```bash
npm i -D covra @playwright/test
npx playwright install chromium
```

## 1. Add Covra Config

Create `covra.config.ts`:

```ts
import { defineCovraConfig } from 'covra'

export default defineCovraConfig({
  framework: 'next',
  collect: {
    browser: true,
    server: true,
  },
  include: [
    'app/**/*.{js,jsx,ts,tsx}',
    'pages/**/*.{js,jsx,ts,tsx}',
    'src/**/*.{js,jsx,ts,tsx}',
  ],
  exclude: [
    '**/*.test.*',
    '**/*.spec.*',
    '**/*.stories.*',
  ],
  all: true,
  strict: true,
  reports: ['text-summary', 'html', 'lcov', 'json', 'json-summary'],
  thresholds: {
    lines: 80,
    statements: 80,
    functions: 75,
    branches: 70,
  },
})
```

You can generate this with:

```bash
npx covra init
```

Use `npx covra init --dry-run` to preview the files before writing them.

## 2. Enable Next.js Source Maps in Coverage Mode

Wrap your Next.js config:

```ts
// next.config.ts
import type { NextConfig } from 'next'
import { withCovra } from 'covra/next'

const nextConfig: NextConfig = {}

export default withCovra(nextConfig)
```

`withCovra()` only changes the config when one of these environment variables is set to `1`:

- `COVRA`
- `COVRA_COVERAGE`
- `E2E_COVERAGE`

In coverage mode, it enables browser production source maps and Next.js server source maps.

## 3. Add the Playwright Fixture

```ts
// e2e/covra.fixture.ts
import { test as base, expect } from '@playwright/test'
import { covraFixture } from 'covra/playwright'

export const test = base.extend({
  ...covraFixture(),
})

export { covraMark } from 'covra/playwright'
export { expect }
```

Then import from that fixture:

```ts
import { test, expect } from './covra.fixture'
```

The fixture starts JavaScript coverage for Chromium pages and writes raw browser V8 artifacts under `.covra/raw/browser`. It also records top-level navigations and API requests so the dashboard can distinguish routes that were actually exercised by E2E flows from route files that were only loaded by the Next.js server.

To make the UX dashboard more expressive, mark user-visible states inside tests:

```ts
import { test, expect, covraMark } from './covra.fixture'

test('checkout shows validation errors', async ({ page }, testInfo) => {
  covraMark(testInfo, { route: '/checkout', state: 'validation.error' })
  await page.goto('/checkout')
  await page.getByRole('button', { name: 'Pay' }).click()
  await expect(page.getByText('Card number is required')).toBeVisible()
})
```

State marks are optional. Without them, Covra still reports route, E2E flow, runtime, line, and branch coverage. With them, the dashboard can show which product states were intentionally exercised.

## 4. Run the Next.js Server Through Covra

Covra needs to wrap the server process so `NODE_V8_COVERAGE` and the server flush agent are installed:

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command:
      'COVRA=1 COVRA_COVERAGE=1 E2E_COVERAGE=1 next build --webpack && covra start-server -- next start',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
```

Use `next build --webpack` for coverage until your Next.js version emits the production browser source maps you need from Turbopack.

## 5. Run Coverage

Single command:

```bash
npx covra run -- playwright test --project=chromium
```

Manual phases:

```bash
npx covra clean
npx playwright test --project=chromium
npx covra doctor --post-run
npx covra report --check
```

Outputs:

- `.covra/raw/browser`: raw browser V8 artifacts
- `.covra/raw/server`: raw server V8 artifacts
- `coverage/covra/index.html`: route-first E2E UX dashboard
- `coverage/covra/route-coverage.json`: dashboard data
- `coverage/covra/coverage-final.json`: Istanbul coverage map
- `coverage/covra/lcov.info`: LCOV
- `coverage/covra/covra-meta.json`: runtime/source-map metadata used by `explain`

## 6. Inspect Routes and Files

```bash
npx covra routes
```

This prints route-level coverage for App Router pages, Pages Router pages, route handlers, and API routes.

`E2E flow` is the primary signal:

- `covered`: Playwright navigated to the route, requested the API route, or a test marked the route with `covraMark()`
- `missing`: the route exists in the app, but no observed E2E flow exercised it

Source `Lines` and `Branches` are still shown, but treat them as source-level detail. In Next.js production builds, server-side module loading can make source lines look covered even when a route is missing from the user-flow perspective.

```bash
npx covra explain app/dashboard/page.tsx
```

This shows:

- coverage metrics for the file
- whether it was covered by browser, server, merged, or empty coverage
- source-map status
- generated bundle sources that mapped to the file
- route mapping
- observed UX states
- uncovered lines

## 7. Add CI

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx covra run -- playwright test --project=chromium
```

For Covra development itself, use `npm run check:release`; see [Release Process](release.md).
