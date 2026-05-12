# CLI Reference

Use `npx covra <command>` or add scripts to `package.json`.

## `covra init`

Creates starter files:

- `covra.config.ts`
- `e2e/covra.fixture.ts`

Options:

- `--dry-run`: print files instead of writing them

Example:

```bash
npx covra init --dry-run
npx covra init
```

`init` does not overwrite existing files.

## `covra clean`

Removes raw artifacts and reports, then recreates the browser/server raw directories.

```bash
npx covra clean
```

Options:

- `-c, --config <file>`

## `covra doctor`

Runs preflight checks for config, Next.js, Playwright, source files, raw artifacts, and source maps.

```bash
npx covra doctor
```

By default, raw artifacts and source maps are optional because you may run this before E2E tests.

## `covra doctor --post-run`

Runs completed-run checks. This fails if expected runtime artifacts or source maps are missing.

```bash
npx covra doctor --post-run
```

Run this after Playwright and before trusting the report.

## `covra run -- <command>`

Runs a test command, then generates coverage reports and checks thresholds.

```bash
npx covra run -- playwright test --project=chromium
```

If no command is provided, Covra runs:

```bash
npx playwright test --project=chromium
```

Options:

- `-c, --config <file>`
- `--no-check`: skip threshold checks after report generation

`covra run` sets coverage-mode environment variables for the test command. Your Playwright config should still use `covra start-server` for the Next.js server.

## `covra start-server -- <command>`

Runs a server command with server V8 coverage configured.

```bash
npx covra start-server -- next start
```

This sets:

- `NODE_V8_COVERAGE`
- `NODE_OPTIONS=--enable-source-maps --import=<covra server agent>`
- `COVRA=1`
- `COVRA_COVERAGE=1`
- `E2E_COVERAGE=1`

Use it inside Playwright `webServer.command`.

## `covra report`

Converts raw browser/server artifacts into Istanbul-compatible reports.

```bash
npx covra report
```

Options:

- `-c, --config <file>`
- `--check`: evaluate thresholds after writing reports

Outputs are written to `outputDir`, which defaults to `coverage/covra`.

## `covra report --check`

Recommended CI command after Playwright:

```bash
npx covra report --check
```

This fails when:

- remap diagnostics contain errors
- configured thresholds fail

## `covra check [coverageFile]`

Checks thresholds against an existing Istanbul coverage map.

```bash
npx covra check
npx covra check coverage/covra/coverage-final.json
```

If `coverageFile` is omitted, Covra uses `coverage/covra/coverage-final.json`.

## `covra explain <file>`

Explains one file in the latest report.

```bash
npx covra explain app/dashboard/page.tsx
```

It prints:

- line, statement, function, and branch coverage
- runtime attribution
- source-map status
- generated bundle sources
- uncovered lines

Run `covra report` first.

## Exit Codes

- `0`: command succeeded
- `1`: command failed, thresholds failed, required artifacts were missing, or diagnostics contained errors

Playwright failures propagate through `covra run`.
