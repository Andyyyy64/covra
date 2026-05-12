# Covra Documentation

Covra is a runtime coverage tool for Playwright-powered Next.js apps. It collects coverage from the browser and the Next.js server process, remaps generated JavaScript back to source files, writes Istanbul-compatible reports, and explains the result.

Use this documentation in this order:

1. [Getting Started](getting-started.md) for the shortest production setup.
2. [Next.js and Playwright Integration](nextjs-playwright.md) for the integration details behind that setup.
3. [Configuration Reference](configuration.md) when you need to tune include globs, reports, source maps, thresholds, or merge inputs.
4. [Reports, Thresholds, and Merge](reports-thresholds.md) when wiring CI gates, Codecov, Sonar, Vitest, Jest, c8, or nyc.
5. [Diagnostics and Troubleshooting](diagnostics.md) when coverage is missing, paths look wrong, or confidence is below 100%.
6. [Production Guide](production.md) before using Covra as a CI gate.
7. [Architecture](architecture.md) when changing Covra itself or debugging a deep source-map issue.
8. [Release Process](release.md) when cutting or validating a release.

## Current Support Envelope

Covra v0.2 is production-ready for:

- Next.js on the Node runtime
- App Router pages, layouts, and route handlers
- Pages Router pages, `getServerSideProps`, and API routes
- Playwright Chromium E2E tests
- webpack production builds
- TypeScript, TSX, JavaScript, and JSX
- Istanbul-compatible consumers

The unsupported list is explicit in [Production Guide](production.md). Treat anything outside that envelope as experimental until it has a fixture and release-gate coverage.
