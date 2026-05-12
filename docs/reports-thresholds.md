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

- App Router page/layout/route files
- Pages Router page/API/special files
- route path
- browser/server/merged/empty runtime
- line and branch coverage
- explicit UX state marks from `covraMark()`

Source-level Istanbul metrics are still present, but they are supporting detail rather than the top-level UX.

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
