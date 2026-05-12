# Contributing

Thanks for helping make Covra reliable. Coverage tools are only useful when users can trust the numbers, so changes should include concrete verification.

## Project Scope

Covra's core is:

```text
Playwright browser V8 coverage
  + Next.js server V8 coverage
  + source-map remap
  + Istanbul-compatible reports
  + diagnostics and thresholds
```

Covra is not a Vitest provider. Vitest support is artifact compatibility through Istanbul `coverage-final.json` files.

## Local Checks

```bash
npm ci
npx playwright install chromium
npm run check:docs
npm run check:release
```

`check:release` runs type checking, unit tests, docs link checks, a real Next.js App Router + Pages Router fixture, an external smoke test against `vercel/next.js/examples/with-playwright`, `npm audit`, build, and `npm pack --dry-run`.

## Design Principles

- Keep Vitest optional. Covra core reads Istanbul-compatible artifacts; it is not a Vitest provider.
- Prefer V8 coverage and source maps over build-pipeline instrumentation.
- Treat missing browser/server artifacts as errors in strict mode.
- Keep diagnostics actionable. Runtime/framework noise should not lower coverage confidence.
- Add or update the Next fixture when changing collection, conversion, source-map, or CLI behavior.
- Add or update docs when changing user-facing behavior.
- Keep README short enough to orient users, and put durable details in `docs/`.

## Documentation Changes

When docs change, run:

```bash
npm run check:docs
```

The docs checker validates internal Markdown file links and anchors. It intentionally does not check remote URLs, so do not rely on it to validate external documentation.

## Release-sensitive Changes

Run the full release gate when touching any of these areas:

- `src/playwright.ts`
- `src/next.ts`
- `src/commands.ts`
- `src/convert.ts`
- `src/reports.ts`
- `src/thresholds.ts`
- fixture files under `fixtures/`
- scripts under `scripts/`
- docs that describe release, support, CI, or production behavior
