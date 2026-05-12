# Production Guide

Covra can be used as a production CI gate when your project fits the support envelope below and your release checks pass with 100% confidence.

## Supported Today

Runtime and framework:

- Node.js 20 or newer
- Next.js on the Node runtime
- App Router pages, layouts, and route handlers
- Pages Router pages, `getServerSideProps`, and API routes

Test runner:

- `@playwright/test`
- Chromium project for coverage
- parallel workers are supported for suite-level coverage

Build:

- production Next.js build
- webpack source maps
- `withCovra()` active only during coverage mode

Reports:

- Istanbul-compatible `coverage-final.json`
- LCOV
- HTML
- JSON summary
- text summary
- route-first E2E UX dashboard
- E2E flow coverage for route/page/API surfaces

CI:

- threshold checks
- `doctor --post-run`
- source-map diagnostics
- optional merge of existing Istanbul coverage artifacts

## Not Supported Yet

- Firefox or WebKit coverage collection
- Edge Runtime coverage
- Turbopack production browser coverage
- Vercel remote deployment coverage
- Service Worker or Web Worker coverage
- per-test server coverage attribution
- CSS coverage thresholds
- a Vitest custom coverage provider

If you need one of these, treat it as a new feature that requires a fixture, diagnostics, and release-gate coverage before calling it production-ready.

## Recommended CI Gate

```bash
npm ci
npx playwright install --with-deps chromium
npx covra run -- playwright test --project=chromium
npx covra doctor --post-run
npx covra report --check
```

If you use `covra run`, it already runs `report` and threshold checks after the test command. Keeping an explicit `doctor --post-run` is still useful when you want artifact/source-map failure messages in CI logs.

## Security and Artifact Handling

Raw artifacts can contain:

- source code
- local absolute paths
- route names
- generated bundle details
- source-map content

Default raw directory:

```text
.covra/raw
```

Do not upload `.covra/` as a public artifact. Prefer uploading only:

- `coverage/covra/lcov.info`
- `coverage/covra/coverage-summary.json`
- `coverage/covra/index.html` if you are comfortable publishing source-mapped snippets

## Source Maps

Source maps are necessary for trustworthy reports, but they should only be enabled during coverage runs.

Use:

```ts
export default withCovra(nextConfig)
```

and ensure the coverage build has:

```bash
COVRA=1 COVRA_COVERAGE=1 E2E_COVERAGE=1
```

## Parallelism

Browser coverage is written per test artifact. Server coverage is suite-level because a single Next.js server can be shared by multiple Playwright workers.

This means Covra v0.2.1 can answer:

- which routes were observed by real E2E flows
- which route files were loaded by browser/server runtime coverage
- which explicit UX states were marked by tests
- whether coverage came from browser, server, merged, or empty coverage

It does not claim exact per-test server attribution.

Treat source coverage as a secondary signal in production reviews. `Lines 100%` can happen for a route file that the Next.js server loaded, even when no Playwright navigation or UX state covered that route. Use `E2E flow` and `UX states` as the primary route-level gate.

## Performance Expectations

Coverage runs do more work than normal E2E runs:

- Next.js emits source maps
- Chromium records JavaScript coverage
- Node writes V8 coverage
- Covra converts and remaps coverage
- reports are generated

Keep coverage runs in CI and release checks. For local development, run targeted Playwright projects or use `covra explain` after a report exists.

## Production Readiness Checklist

Before relying on Covra in CI:

- `npx covra doctor` passes before the run
- Playwright uses the Covra fixture for Chromium tests
- Playwright starts Next.js through `covra start-server`
- coverage build uses `next build --webpack`
- `npx covra doctor --post-run` passes
- `npx covra report --check` passes
- `npx covra routes` shows the expected route files
- important routes show `E2E flow covered`
- intentionally untested routes are reviewed as `missing` or excluded from the coverage scope
- confidence is `100%`
- included files are intentional
- `all: true` is enabled
- important modal/error/empty/loading states are marked with `covraMark()`
- raw artifacts are not published publicly
