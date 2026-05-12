# Diagnostics and Troubleshooting

Covra is designed around explainable coverage. If the number is wrong or incomplete, the tool should tell you what boundary failed.

## First Commands to Run

Before E2E:

```bash
npx covra doctor
```

After E2E:

```bash
npx covra doctor --post-run
npx covra report --check
```

For route-level coverage:

```bash
npx covra routes
```

For a suspicious file:

```bash
npx covra explain app/dashboard/page.tsx
```

## Coverage Confidence

`covra report` prints a confidence value:

```text
Coverage
  Lines       100.00%
  Statements  100.00%
  Functions   100.00%
  Branches    100.00%
  Confidence  100%
```

Confidence starts at 100 and drops when diagnostics contain warnings or errors. A production CI gate should aim for 100% confidence. If confidence is lower, inspect diagnostics before trusting the percentage.

## `doctor`

`covra doctor` checks:

- config file discovery
- Next.js config discovery
- Playwright config discovery
- source files matched by include/exclude
- browser raw artifact directory
- server raw artifact directory
- source maps found by configured search globs

Use `--post-run` after Playwright. It turns missing artifacts and missing source maps into failures.

## `explain`

`covra explain <file>` reads the latest `coverage-final.json` and `covra-meta.json`.

Example:

```text
src/ClientCounter.tsx

Lines       100.00%
Statements  100.00%
Functions   100.00%
Branches    100.00%

Runtime     browser, server, merged
Source map  resolved

Generated sources
  http://127.0.0.1:3000/_next/static/chunks/app/page-abc123.js
  file:///repo/.next/server/app/page.js
```

Runtime values:

- `browser`: covered by Playwright browser V8 coverage
- `server`: covered by Node server V8 coverage
- `merged`: merged from another Istanbul coverage file
- `empty`: included through `all: true` but never executed

## UX State Marks

Use `covraMark()` in Playwright tests when a route has meaningful user-visible states:

```ts
covraMark(testInfo, { route: '/settings', state: 'modal.open' })
covraMark(testInfo, { route: '/settings', state: 'validation.error' })
covraMark(testInfo, { route: '/settings', state: 'permission.denied' })
```

The route dashboard shows these states next to branch coverage. This gives reviewers a more useful signal than raw line coverage alone.

## Common Failures

### No browser artifacts

Symptoms:

- `doctor --post-run` reports `0 browser coverage artifacts found`
- client components are `0%` or absent

Check:

- tests import from the Covra fixture
- the Playwright project is Chromium
- the fixture is not disabled
- pages are created through the tracked browser context

### No server artifacts

Symptoms:

- `doctor --post-run` reports `0 server coverage artifacts found`
- App Router server files, route handlers, Pages Router API routes, or `getServerSideProps` are missing

Check:

- Playwright `webServer.command` uses `covra start-server -- next start`
- `reuseExistingServer` is `false` in CI
- the server command runs from the project root
- `NODE_OPTIONS` is not overwritten after Covra starts the server

### Source maps missing

Symptoms:

- confidence drops
- diagnostics mention remap failures
- `explain` shows `Source map  missing` or `unknown`

Check:

- `withCovra()` is used in `next.config.*`
- coverage build has `COVRA=1`, `COVRA_COVERAGE=1`, or `E2E_COVERAGE=1`
- coverage build uses `next build --webpack`
- `.next/static/**/*.map` and `.next/server/**/*.map` exist
- `sourceMaps.search` includes custom output locations

### Files missing from the report

Check:

- `include` matches the files
- `exclude` does not remove them
- `all: true` is enabled
- paths are relative to `rootDir`

Run:

```bash
npx covra doctor
```

It prints how many source files matched include/exclude.

### Coverage looks too high

The most common cause is `all: false` or overly narrow include globs. Keep `all: true` in CI so unexecuted files are reported as `0%`.

Also check whether the route was visited only in a happy path. High line coverage does not prove modal, error, empty, loading, permission, or validation states were covered. Use `covraMark()` and inspect route branch coverage.

### Coverage looks too low

Check:

- source maps are resolved
- browser and server artifacts both exist
- unit coverage merge files are present if you expect merged unit coverage
- tests actually execute the route or interaction

Use `explain` on a low-coverage file to see runtime attribution and generated sources.

### Thresholds fail but report generation succeeds

Use:

```bash
npx covra explain <worst-file>
```

Then decide whether to:

- add E2E coverage for the real user flow
- merge unit coverage for isolated branches
- adjust thresholds for a legacy path
- exclude generated or non-runtime files from `include`

## Debugging Raw Artifacts

Set:

```ts
debug: {
  keepRaw: true,
}
```

Then run:

```bash
npx covra run -- playwright test --project=chromium
```

Inspect `.covra/raw/browser` and `.covra/raw/server`. These files may contain source code and local paths, so do not attach them to public issues without review.
