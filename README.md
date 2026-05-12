# Covra

Runtime coverage for Playwright-powered Next.js apps.

Covra collects browser and Next.js server runtime coverage while Playwright E2E tests run, maps bundled JavaScript back to your source files, writes Istanbul-compatible reports, and gives you diagnostics when the numbers look suspicious.

It is intentionally not a Vitest plugin. Vitest, Jest, c8, nyc, Codecov, and Sonar can consume or merge with Covra through standard Istanbul artifacts.

## Why Covra

Unit coverage tells you what isolated tests execute. E2E coverage tells you what real user flows execute.

Next.js makes that hard because meaningful code runs in more than one place: hydrated client components, server rendering, App Router route handlers, Pages Router API routes, and `getServerSideProps`. Covra treats those as one runtime coverage problem and makes the result explainable.

## Production Envelope

Covra v0.2 is production-ready inside this explicit envelope:

- Next.js on the Node runtime
- App Router pages, layouts, and route handlers
- Pages Router pages, `getServerSideProps`, and API routes
- Playwright Chromium E2E coverage
- webpack production builds for stable source maps
- TypeScript, TSX, JavaScript, and JSX source files
- HTML, LCOV, JSON, JSON summary, and text reports
- threshold checks without a Vitest dependency
- optional merge of any Istanbul `coverage-final.json`
- `doctor`, `doctor --post-run`, `explain`, `run`, `report`, `check`, `clean`, `init`, and `start-server`
- ESM and CommonJS exports for Playwright's TypeScript loader

Not supported yet:

- Firefox or WebKit coverage collection
- Edge Runtime coverage
- Turbopack production browser coverage
- Vercel remote deployment coverage
- Service Worker or Web Worker coverage
- per-test server coverage attribution
- CSS coverage thresholds
- a Vitest custom coverage provider

See [Production Guide](docs/production.md) for the exact support contract and operational guidance.

## Install

```bash
npm i -D covra
```

Covra requires Node.js 20 or newer and `@playwright/test` when you use the Playwright fixture.

## Quick Start

Generate starter files:

```bash
npx covra init
```

Run `--dry-run` first if you want to preview the files:

```bash
npx covra init --dry-run
```

Wire your Playwright tests through the generated fixture:

```ts
// e2e/covra.fixture.ts
import { test as base, expect } from '@playwright/test'
import { covraFixture } from 'covra/playwright'

export const test = base.extend({
  ...covraFixture(),
})

export { expect }
```

Then import from that fixture in E2E specs:

```ts
import { test, expect } from './covra.fixture'
```

Enable coverage source maps only during coverage runs:

```ts
// next.config.ts
import { withCovra } from 'covra/next'

const nextConfig = {}

export default withCovra(nextConfig)
```

Run the Next.js server through Covra so server runtime coverage is captured:

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
  },
})
```

Run coverage:

```bash
npx covra run -- playwright test --project=chromium
```

Or run each phase yourself:

```bash
npx covra clean
npx playwright test --project=chromium
npx covra doctor --post-run
npx covra report --check
```

Detailed setup is in [Getting Started](docs/getting-started.md).

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

`merge.coverageFiles` accepts any Istanbul-compatible coverage map, including Vitest, Jest, c8, and nyc output. Vitest is optional.

See [Configuration Reference](docs/configuration.md).

## Documentation

- [Getting Started](docs/getting-started.md)
- [Next.js and Playwright Integration](docs/nextjs-playwright.md)
- [CLI Reference](docs/cli.md)
- [Configuration Reference](docs/configuration.md)
- [Reports, Thresholds, and Merge](docs/reports-thresholds.md)
- [Diagnostics and Troubleshooting](docs/diagnostics.md)
- [Architecture](docs/architecture.md)
- [Production Guide](docs/production.md)
- [Release Process](docs/release.md)

## Verification

Covra's release gate runs:

```bash
npm ci
npx playwright install --with-deps chromium
npm run check:release
```

`check:release` includes type checking, unit tests, docs link checks, a real local Next.js App Router + Pages Router fixture, an external smoke test against `vercel/next.js/examples/with-playwright`, `npm audit`, build, and `npm pack --dry-run`.

## Security

Coverage artifacts and source maps can contain source code, local paths, route names, and generated bundle details. Covra writes them locally and never uploads them. Do not publish `.covra/` raw artifacts or HTML reports unless you have reviewed their contents.

See [SECURITY.md](SECURITY.md).

## License

MIT
