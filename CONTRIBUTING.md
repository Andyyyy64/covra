# Contributing

Thanks for helping make Covra reliable. Coverage tools are only useful when users can trust the numbers, so changes should include concrete verification.

## Local Checks

```bash
npm ci
npx playwright install chromium
npm run check:release
```

`check:release` runs type checking, unit tests, a real Next.js + Playwright fixture, `npm audit`, and `npm pack --dry-run`.

## Design Principles

- Keep Vitest optional. Covra core reads Istanbul-compatible artifacts; it is not a Vitest provider.
- Prefer V8 coverage and source maps over build-pipeline instrumentation.
- Treat missing browser/server artifacts as errors in strict mode.
- Keep diagnostics actionable. Runtime/framework noise should not lower coverage confidence.
- Add or update the Next fixture when changing collection, conversion, source-map, or CLI behavior.
