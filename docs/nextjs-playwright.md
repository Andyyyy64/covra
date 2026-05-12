# Next.js and Playwright Integration

Covra needs three integration points:

1. `withCovra()` in `next.config.*`
2. `covraFixture()` in Playwright tests
3. `covra start-server -- <server command>` around the Next.js server

Each one covers a different runtime boundary.

## Next.js Config

```ts
import { withCovra } from 'covra/next'

const nextConfig = {}

export default withCovra(nextConfig)
```

`withCovra()` is inactive unless coverage mode is enabled with `COVRA=1`, `COVRA_COVERAGE=1`, or `E2E_COVERAGE=1`.

When active, it sets:

- `productionBrowserSourceMaps: true`
- `experimental.serverSourceMaps: true`

This keeps normal production builds unchanged while allowing coverage runs to remap generated browser and server bundles back to source files.

## Playwright Fixture

```ts
import { test as base, expect } from '@playwright/test'
import { covraFixture } from 'covra/playwright'

export const test = base.extend({
  ...covraFixture(),
})

export { expect }
```

The fixture:

- runs only for Chromium coverage
- starts `page.coverage.startJSCoverage()`
- keeps coverage across navigation with `resetOnNavigation: false` by default
- tracks pages created in the browser context
- writes raw browser artifacts after each test
- tolerates pages that close before coverage can stop

Firefox and WebKit tests may still run in your suite, but Covra v0.2 does not collect coverage from them.

## Server Wrapper

Use:

```bash
covra start-server -- next start
```

The wrapper sets:

- `COVRA=1`
- `COVRA_COVERAGE=1`
- `E2E_COVERAGE=1`
- `NODE_V8_COVERAGE=<raw server dir>`
- `NODE_OPTIONS=--enable-source-maps --import=<covra server agent>`

The server agent flushes coverage when the process exits so Playwright teardown does not lose server runtime coverage.

## Recommended Playwright Config

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:3000',
  },
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

`reuseExistingServer: false` is recommended for CI so Covra controls the server process and its coverage environment.

## App Router Coverage

Supported in v0.2:

- `app/**/page.tsx`
- `app/**/layout.tsx`
- `app/**/route.ts`
- server-rendered code on the Node runtime
- browser-side client component execution

Server Components and server-rendered paths are covered through server V8 coverage. Hydrated client component behavior is covered through browser V8 coverage.

## Pages Router Coverage

Supported in v0.2:

- `pages/**/*.tsx`
- `getServerSideProps`
- `pages/api/**/*.ts`
- browser-side page behavior after hydration

Pages Router support is verified by Covra's local release fixture.

## Source Maps and webpack

Covra needs source maps for generated browser and server bundles. Use a webpack production build for coverage:

```bash
next build --webpack
```

Turbopack production browser coverage is not part of the v0.2 support envelope.

## CommonJS Compatibility

Playwright's TypeScript loader can load fixtures through CommonJS. Covra publishes both ESM and CJS exports:

- `covra`
- `covra/playwright`
- `covra/next`

This is verified in the release gate.
