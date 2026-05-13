# Configuration Reference

Covra loads the first config file it finds:

- `covra.config.ts`
- `covra.config.mts`
- `covra.config.js`
- `covra.config.mjs`

You can pass a config explicitly:

```bash
npx covra report --config fixtures/next-app-router/covra.config.ts
```

## Full Example

```ts
import { defineCovraConfig } from 'covra'

export default defineCovraConfig({
  rootDir: '.',
  framework: 'next',
  strict: true,
  include: [
    'app/**/*.{js,jsx,ts,tsx}',
    'pages/**/*.{js,jsx,ts,tsx}',
    'src/**/*.{js,jsx,ts,tsx}',
  ],
  exclude: [
    '**/*.test.*',
    '**/*.spec.*',
    '**/*.stories.*',
    '**/__tests__/**',
    '**/node_modules/**',
    '**/.next/**',
  ],
  all: true,
  rawDir: '.covra/raw',
  outputDir: 'coverage/covra',
  reports: ['text-summary', 'html', 'lcov', 'json', 'json-summary'],
  thresholds: {
    lines: 80,
    statements: 80,
    functions: 75,
    branches: 70,
  },
  collect: {
    browser: {
      enabled: true,
      project: 'chromium',
      resetOnNavigation: false,
      reportAnonymousScripts: false,
      trackUiEvents: true,
      maxUiEvents: 2000,
    },
    server: {
      enabled: true,
      coverageDir: '.covra/raw/server',
      teardownWaitMs: 3000,
    },
  },
  merge: {
    coverageFiles: ['coverage/unit/coverage-final.json'],
  },
  sourceMaps: {
    search: [
      '.next/static/**/*.map',
      '.next/server/**/*.map',
      'dist/**/*.map',
      'build/**/*.map',
    ],
  },
  debug: {
    keepRaw: false,
  },
})
```

## `rootDir`

Default: directory containing the config file, or the current working directory when no config exists.

Covra canonicalizes this path with `realpathSync()` when it exists. This avoids macOS `/var` versus `/private/var` path mismatches during external smoke tests and temporary project runs.

## `framework`

Default: `'next'`

Supported values:

- `'next'`
- `'generic'`

The v0.2.1 production envelope is Next.js. Generic mode is available for experimentation but is not release-gate supported.

## `include` and `exclude`

Defaults:

```ts
include: [
  'app/**/*.{js,jsx,ts,tsx}',
  'pages/**/*.{js,jsx,ts,tsx}',
  'src/**/*.{js,jsx,ts,tsx}',
]
exclude: [
  '**/*.test.*',
  '**/*.spec.*',
  '**/*.stories.*',
  '**/__tests__/**',
  '**/node_modules/**',
  '**/.next/**',
]
```

These globs define the source files Covra reports on. Keep `include` focused on user-owned source files. Do not include `.next`, test files, or `node_modules`.

## `all`

Default: `true`

When enabled, files matched by `include` but not executed by browser or server coverage are added to the report as `0%`. This prevents the report from looking artificially high because unexecuted files were absent from raw V8 artifacts.

## `strict`

Default: `true`

Strict mode treats important remap failures as errors. Keep this enabled in CI. Lowering it can make reports easier to generate, but it also makes the result less trustworthy.

## `collect.browser`

Default:

```ts
{
  enabled: true,
  project: 'chromium',
  resetOnNavigation: false,
  reportAnonymousScripts: false,
  trackUiEvents: true,
  maxUiEvents: 2000,
}
```

The Playwright fixture only collects browser coverage for Chromium. `resetOnNavigation: false` is important for E2E flows that navigate across pages.

When `trackUiEvents` is enabled, Covra records common browser-side UX telemetry in the same raw artifact as V8 coverage:

- clicks
- changes
- submits
- Enter, Escape, and Space key actions
- open dialogs, disclosures, menus, alerts, and live regions
- large or semantic lists, tables, grids, and checklist-like surfaces
- API/network calls correlated to the current page route when possible

`maxUiEvents` caps the number of UI telemetry events stored per Playwright test. Increase it for very long flows, or lower it if raw artifacts become noisy.

## `collect.server`

Default:

```ts
{
  enabled: true,
  coverageDir: '<rawDir>/server',
  teardownWaitMs: 3000,
}
```

Server coverage is collected by `covra start-server`, which sets `NODE_V8_COVERAGE` and installs the server flush agent through `NODE_OPTIONS`.

## `rawDir`

Default: `.covra/raw`

Raw artifacts are written under:

- `.covra/raw/browser`
- `.covra/raw/server`

These files may contain source code and local paths. Do not publish them without review.

## `outputDir`

Default: `coverage/covra`

Reports are written here:

- `coverage-final.json`
- `lcov.info`
- `coverage-summary.json`
- `index.html`
- `covra-meta.json`

## `reports`

Default:

```ts
['text-summary', 'html', 'lcov', 'json', 'json-summary']
```

Supported built-in reports:

- `text`
- `text-summary`
- `html`
- `lcov`
- `json`
- `json-summary`

## `thresholds`

Thresholds use Vitest-like semantics without depending on Vitest:

- positive numbers mean minimum percentage
- negative numbers mean maximum uncovered count
- `perFile: true` applies the block to each file
- `100: true` requires full coverage for lines, statements, functions, and branches
- glob keys apply nested threshold blocks to matching files

Thresholds currently evaluate Istanbul source metrics. They do not fail CI on `E2E flow` status yet. Use `covra routes`, `route-coverage.json`, and the HTML dashboard to review missing route flows until route-flow thresholds are added.

See [Reports, Thresholds, and Merge](reports-thresholds.md).

## `merge.coverageFiles`

Default: `[]`

Add Istanbul-compatible `coverage-final.json` files:

```ts
merge: {
  coverageFiles: [
    'coverage/unit/coverage-final.json',
    'coverage/component/coverage-final.json',
  ],
}
```

This works with Vitest, Jest, c8, nyc, and other Istanbul-compatible tools.

`merge.vitest` is still accepted as an alias, but `merge.coverageFiles` is preferred because Covra core is not Vitest-specific.

## `sourceMaps.search`

Default:

```ts
[
  '.next/static/**/*.map',
  '.next/server/**/*.map',
  'dist/**/*.map',
  'build/**/*.map',
]
```

If Covra cannot remap generated scripts to source files, add the relevant source-map locations here and run:

```bash
npx covra doctor --post-run
npx covra report --check
```

## `debug.keepRaw`

Default: `false`

When `false`, `covra run` removes old raw artifacts and reports before running tests. Set it to `true` only when debugging raw artifact behavior.
