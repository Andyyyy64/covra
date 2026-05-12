# Architecture

Covra is a small orchestration layer around runtime coverage.

```text
Playwright Chromium tests
  -> browser V8 coverage artifacts

Next.js server process
  -> Node V8 coverage artifacts

Covra report
  -> source-map lookup
  -> V8 to Istanbul conversion
  -> merge existing Istanbul artifacts
  -> add unexecuted files as 0%
  -> reports, metadata, thresholds
```

## Packages and Public Entrypoints

Single npm package:

```text
covra
```

Exports:

- `covra`: config helpers and public types
- `covra/playwright`: Playwright fixture
- `covra/next`: Next.js config helper

Both ESM and CommonJS exports are published for these paths.

## Browser Coverage

The Playwright fixture uses Chromium's JavaScript coverage API:

```ts
page.coverage.startJSCoverage({
  resetOnNavigation: false,
  reportAnonymousScripts: false,
})
```

Artifacts are written to:

```text
.covra/raw/browser
```

Each artifact includes:

- test title
- test file
- Playwright project
- worker index
- retry
- status
- V8 coverage entries

## Server Coverage

`covra start-server -- <command>` runs the server with:

```text
NODE_V8_COVERAGE=.covra/raw/server
NODE_OPTIONS=--enable-source-maps --import=<server-agent>
```

Artifacts are written to:

```text
.covra/raw/server
```

The server agent flushes coverage at process exit.

## Source-map Remap

Covra searches source maps from:

```ts
[
  '.next/static/**/*.map',
  '.next/server/**/*.map',
  'dist/**/*.map',
  'build/**/*.map',
]
```

It normalizes source paths to the canonical project root. This avoids duplicate paths when the same temp directory is visible through different absolute path prefixes.

## Istanbul Output

Covra converts runtime coverage into Istanbul-compatible file coverage and writes:

```text
coverage/covra/coverage-final.json
```

This keeps downstream tooling simple:

- Codecov can read LCOV
- Sonar can read LCOV
- Vitest/Jest/c8/nyc coverage can be merged when it is Istanbul-compatible

## Runtime Metadata

Covra writes:

```text
coverage/covra/covra-meta.json
```

This powers `covra explain` with:

- runtime attribution
- generated source URLs
- source-map status

Runtime attribution is file-level:

- `browser`
- `server`
- `merged`
- `empty`

## Confidence

Coverage confidence is derived from diagnostics. Warnings and errors lower confidence because a clean percentage can be misleading when source maps or artifacts are missing.

The goal for supported production usage is `100%`.

## Design Decisions

Covra is not a Vitest provider.

The core is independent:

```text
V8 coverage + source maps + Istanbul output
```

Vitest support is artifact-level compatibility through `coverage-final.json`.

Covra is also not a build instrumentation tool. It prefers native browser and Node V8 coverage so it does not require Babel or SWC instrumentation.
