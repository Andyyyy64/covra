# Reports, Thresholds, and Merge

Covra writes a route-first E2E UX dashboard and Istanbul-compatible coverage artifacts so existing CI and reporting tools can consume the result.

## Report Files

Default output directory:

```text
coverage/covra
```

Default files:

```text
coverage/covra/coverage-final.json
coverage/covra/coverage-summary.json
coverage/covra/route-coverage.json
coverage/covra/lcov.info
coverage/covra/index.html
coverage/covra/dashboard.html
coverage/covra/covra-meta.json
```

`index.html` and `dashboard.html` are Covra's E2E UX dashboard. The Istanbul-compatible source-level report remains available through generated source pages and LCOV output.

`route-coverage.json` contains the route dashboard model. `covra-meta.json` is Covra-specific metadata used by `covra explain`. It records runtime attribution, generated URLs, source-map status, route mapping, tests, and explicit UX states.

## Route-first Dashboard

The dashboard is the primary human-facing report. It groups coverage by:

- App Router page and route-handler files
- Pages Router page and API files
- route path
- E2E flow status
- browser/server/merged/empty runtime
- line and branch coverage
- explicit UX state marks from `covraMark()`

`E2E flow` is the main coverage signal for product UX. A route is `covered` when Covra observes one of these during Playwright:

- a top-level page navigation for the route
- an API request for the route
- an explicit `covraMark()` for the route

Routes without those observations are `missing`, even if source lines appear covered through Next.js server module loading. This matters for real apps: production server coverage can prove that a file was loaded or rendered, but it does not prove that an end user journey intentionally exercised that route.

Source-level Istanbul metrics are still present, but they are supporting detail rather than the top-level UX.

Example:

```text
Route              Kind          E2E flow     Lines              Branches           Runtime                UX states  File
/                  app-page      covered      100.0% (12/12)    100.0% (0/0)       browser, server        2          app/page.tsx
/dashboard         app-page      missing      100.0% (18/18)    100.0% (0/0)       server, merged         0          app/dashboard/page.tsx
/api/counter       app-route     covered      100.0% (9/9)      100.0% (0/0)       browser, server        0          app/api/counter/route.ts
```

The `/dashboard` row is the important case: source coverage is `100%`, but E2E flow is still `missing`.

## Built-in Reports

```ts
reports: ['text-summary', 'html', 'lcov', 'json', 'json-summary']
```

Supported report names:

- `text`
- `text-summary`
- `html`
- `lcov`
- `json`
- `json-summary`

## Thresholds

Covra uses Vitest-like threshold semantics without importing or requiring Vitest.

Thresholds evaluate Istanbul source metrics: lines, statements, functions, and branches. They are intentionally separate from `E2E flow`. A route can fail product review as `missing` in the dashboard even when source thresholds pass because the Next.js server loaded that file. For now, use the route dashboard, `route-coverage.json`, and `covra routes` to gate user-flow coverage in review.

```ts
thresholds: {
  lines: 80,
  statements: 80,
  functions: 75,
  branches: 70,
}
```

Positive values are minimum percentages:

```ts
thresholds: {
  lines: 90,
}
```

This means line coverage must be at least `90%`.

Negative values are maximum uncovered counts:

```ts
thresholds: {
  lines: -10,
}
```

This means at most 10 lines may be uncovered.

## Per-file Thresholds

```ts
thresholds: {
  perFile: true,
  lines: 80,
  statements: 80,
}
```

Every reported file must satisfy the block.

## Full Coverage

```ts
thresholds: {
  100: true,
}
```

This requires 100% for lines, statements, functions, and branches.

## Glob Thresholds

```ts
thresholds: {
  lines: 80,
  'app/api/**': {
    lines: 90,
    functions: 80,
  },
  'src/lib/legacy/**': {
    lines: -20,
  },
}
```

Glob blocks apply to matching files in addition to global thresholds.

## Merge Existing Coverage

Covra can merge any Istanbul-compatible coverage map:

```ts
merge: {
  coverageFiles: [
    'coverage/unit/coverage-final.json',
    'coverage/component/coverage-final.json',
  ],
}
```

Common producers:

- Vitest
- Jest
- c8
- nyc
- other Istanbul-compatible tools

Covra core is intentionally not tied to Vitest. If you use Vitest, configure Vitest to write `coverage-final.json` and pass that file through `merge.coverageFiles`.

## Uncovered Files

With `all: true`, Covra adds included but unexecuted source files as `0%`.

This matters because raw V8 coverage usually only contains loaded scripts. Without `all: true`, files never touched by E2E tests could disappear from the report and inflate the summary.

## Branch Coverage Caveat

Covra converts V8 runtime ranges to Istanbul-compatible reports. Lines, statements, and functions are generally the most stable metrics. Branch coverage can differ from instrumentation-based tools in edge cases because V8 range coverage and transformed JavaScript do not always model branches exactly like Istanbul instrumentation.

Use branch thresholds, but keep this difference in mind when comparing Covra to unit-test coverage from another provider.

For E2E UX review, combine branch gaps with `E2E flow` and `UX states`. Branch coverage can hint at unvisited conditionals, while UX state marks let you name the product states that matter: modal open, validation error, empty state, loading state, permission denied, and similar user-visible paths.
