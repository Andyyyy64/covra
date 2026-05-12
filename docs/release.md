# Release Process

This document describes how Covra releases are validated.

## Release Gate

Run:

```bash
npm ci
npx playwright install --with-deps chromium
npm run check:release
```

`check:release` runs:

1. `npm run typecheck`
2. `npm run test`
3. `npm run check:docs`
4. `npm run test:fixture:next`
5. `npm run test:smoke:nextjs-example`
6. `npm audit`
7. `npm pack --dry-run`

## What the Local Fixture Verifies

`npm run test:fixture:next` runs a real Next.js fixture with Playwright and verifies:

- App Router coverage
- Pages Router coverage
- browser coverage artifacts
- server coverage artifacts
- source maps
- `covra start-server`
- Playwright fixture integration
- `covra doctor --post-run`
- `covra report`
- `covra check`
- `covra explain`

The fixture runs Playwright with parallel workers.

## What the External Smoke Test Verifies

`npm run test:smoke:nextjs-example` sparse-clones:

```text
https://github.com/vercel/next.js
```

It uses:

```text
examples/with-playwright
```

The smoke test injects Covra through normal package imports, runs the upstream Playwright tests against Chromium, then verifies:

- App Router source files are present in the report
- Pages Router source files are present in the report
- source maps are resolved
- `doctor --post-run` passes
- `report` passes
- `check` passes
- `explain` works for App Router and Pages Router files
- coverage confidence is 100%

This test is intentionally networked.

## Docs Gate

`npm run check:docs` validates local Markdown links in:

- `README.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `docs/**/*.md`

It checks:

- linked files exist
- linked directories exist
- linked anchors exist when the target is Markdown

## Versioning

Covra is pre-1.0. Minor versions may add supported surfaces and strengthen release gates. Patch versions should be bug fixes, diagnostics improvements, or documentation-only changes.

## Publishing Checklist

Before publishing:

- working tree is clean
- package version is correct
- `npm run check:release` passes
- tag points at the release commit
- tagger and committer identity are correct
- `npm pack --dry-run` includes expected files
- release notes mention support boundaries and known unsupported surfaces
