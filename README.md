# Covra

Runtime coverage for Playwright-powered Next.js apps.

Covra collects browser and Next.js server runtime coverage while Playwright E2E tests run, maps generated JavaScript back to source files, writes Istanbul-compatible reports, and gives you `doctor` / `explain` commands when the numbers look suspicious.

## Production Envelope

Covra is production-ready inside this explicit support envelope:

- Next.js-first coverage config
- Playwright Chromium browser coverage fixture
- Next.js `withCovra()` config helper
- `NODE_V8_COVERAGE` server wrapper
- a small server flush agent so Playwright teardown does not lose server coverage
- V8 to Istanbul conversion
- uncovered source files included as `0%`
- HTML, LCOV, JSON, and text reports
- Vitest-like threshold checks without a Vitest dependency
- optional merge of any Istanbul `coverage-final.json`
- `doctor`, `doctor --post-run`, `explain`, `init`, `run`, `report`, and `check` CLI commands
- strict diagnostics when raw runtime artifacts exist but cannot be remapped to included source files
- release verification against a real Next.js App Router fixture running Playwright in parallel workers

## Install

```bash
npm i -D covra
```

## Quick Start

```bash
npx covra init
```

Then wire the generated fixture into your Playwright tests:

```ts
// e2e/covra.fixture.ts
import { test as base, expect } from '@playwright/test'
import { covraFixture } from 'covra/playwright'

export const test = base.extend({
  ...covraFixture(),
})

export { expect }
```

Use that fixture in E2E specs:

```ts
import { test, expect } from './covra.fixture'
```

Enable source maps only in coverage mode:

```ts
// next.config.ts
import { withCovra } from 'covra/next'

const nextConfig = {}

export default withCovra(nextConfig)
```

Run the Next.js server through Covra so server runtime coverage is written:

```ts
// playwright.config.ts
export default defineConfig({
  webServer: {
    command: 'COVRA=1 COVRA_COVERAGE=1 E2E_COVERAGE=1 next build --webpack && covra start-server -- next start',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: false,
  },
})
```

The coverage build must run with `COVRA=1` or `E2E_COVERAGE=1` so `withCovra()` can enable browser and server source maps. For Next.js versions that default to Turbopack builds, use `next build --webpack` until Turbopack emits the production browser source maps your app needs.

Run E2E coverage:

```bash
npx covra run -- playwright test --project=chromium
```

Or run the pieces yourself:

```bash
covra clean
playwright test --project=chromium
covra doctor --post-run
covra report --check
```

## Config

```ts
// covra.config.ts
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
  merge: {
    coverageFiles: ['coverage/unit/coverage-final.json'],
  },
})
```

`merge.coverageFiles` accepts any Istanbul-compatible coverage map, including Vitest, Jest, c8, or nyc output. Vitest is intentionally optional; Covra's core does not depend on it.

## Commands

```bash
covra init
covra clean
covra doctor
covra doctor --post-run
covra run -- playwright test --project=chromium
covra report --check
covra check
covra explain app/dashboard/page.tsx
covra start-server -- next start
```

`covra doctor` is a preflight check and does not require runtime artifacts yet. `covra doctor --post-run` is a completed-run check and fails when browser/server raw coverage artifacts or source maps are missing.

## Support Boundaries

Supported:

- Next.js on the Node runtime
- Playwright Chromium coverage
- webpack production builds for reliable client/server source maps
- TypeScript, TSX, JavaScript, and JSX source files
- Istanbul-compatible report consumers such as Codecov and Sonar

Not supported yet:

- Firefox or WebKit coverage collection
- Edge Runtime coverage
- Turbopack production browser coverage, until source-map output is reliable enough
- Vercel remote deployment coverage
- Service Worker / Web Worker coverage
- per-test server coverage attribution
- CSS coverage thresholds
- a Vitest custom coverage provider

## Design Notes

Covra is not a Vitest plugin. The core design is:

```text
Playwright E2E
  -> browser V8 coverage
  -> Next.js server V8 coverage
  -> source-map remap
  -> Istanbul-compatible coverage-final.json
  -> reports and threshold checks
```

Vitest integration is just artifact compatibility: run Vitest with coverage, pass its `coverage-final.json` through `merge.coverageFiles`, and Covra will combine it with E2E coverage.

## Release Checks

```bash
npm ci
npx playwright install chromium
npm run check:release
```

This runs unit tests, a real Next.js App Router + Playwright fixture, audit, build, and `npm pack --dry-run`.
