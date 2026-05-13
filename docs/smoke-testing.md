# Smoke Testing

This page documents the smoke tests used to validate Covra against real Next.js projects.

## Release Smoke

Run the standard release smoke test with:

```bash
npm run build
npx playwright install --with-deps chromium
npm run test:smoke:nextjs-example
```

This test sparse-clones:

```text
https://github.com/vercel/next.js
```

and runs Covra against:

```text
examples/with-playwright
```

The script injects Covra into that external project, rewrites the upstream Playwright specs to use `covraFixture()`, runs Chromium E2E tests, then verifies `doctor`, `report`, `check`, `routes`, `explain`, `route-coverage.json`, and the HTML dashboard.

Useful knobs:

```bash
COVRA_SMOKE_DIR=/tmp/covra-smoke npm run test:smoke:nextjs-example
COVRA_SMOKE_PORT=3218 npm run test:smoke:nextjs-example
```

## What Good Output Looks Like

The external smoke should print a route-first table like this:

```text
Route Coverage
Route               Kind           E2E flow      Lines               Branches            Runtime                 UX states  UI events  API calls  File
/                   app-page       covered       100.0% (10/10)      100.0% (0/0)        browser, merged, server  0          1          1          app/page.tsx
/about              app-page       covered       100.0% (10/10)      100.0% (0/0)        browser, merged, server  0          0          1          app/about/page.tsx
/home               pages-page     covered       100.0% (77/77)      100.0% (0/0)        browser, merged         0          1          0          pages/home/index.tsx
/home/about         pages-page     covered       100.0% (15/15)      100.0% (0/0)        browser, merged         0          0          0          pages/home/about.tsx
```

`covra explain app/page.tsx` should also show route and flow evidence:

```text
app/page.tsx

Runtime     server, merged
Source map  resolved
Route       / (app-page)
UI events   1
  click: link "About"
API calls   1
  GET /about 200
```

## Larger OSS Manual Smoke

Large Next.js projects are useful for stress testing, but they often need project-specific environment variables and much longer compile time. Do not treat a large-project timeout as a Covra failure until the app itself can build and serve without Covra.

One manual target that has been tried is:

```text
https://github.com/shadcn-ui/ui
apps/v4
```

Observed local constraints:

- the repository is much larger than the release smoke target
- it uses a pnpm workspace
- `apps/v4` requires `NEXT_PUBLIC_APP_URL`
- production `next build --webpack` can exceed a four minute smoke timeout on a laptop
- `next dev --webpack` can spend more than two minutes compiling heavy docs routes such as `/docs/components`
- the Next dev server may restart when it approaches its memory threshold

A useful manual setup is:

```bash
git clone --depth 1 --filter=blob:none https://github.com/shadcn-ui/ui.git /tmp/covra-shadcn-ui
cd /tmp/covra-shadcn-ui
corepack pnpm install --frozen-lockfile
corepack pnpm --filter=shadcn build
```

Then link the local Covra checkout into the smoke target:

```bash
ln -sfn /path/to/covra node_modules/covra
mkdir -p node_modules/@playwright
ln -sfn /path/to/covra/node_modules/@playwright/test node_modules/@playwright/test
```

Use a Covra config inside `apps/v4` with focused `include` globs. For large docs sites, start with a very small E2E path such as `/` before adding deep docs routes. This helps separate Covra integration problems from app compile time or environment problems.

## Reading Failures

Use this order when a smoke fails:

1. Confirm the app builds or serves without Covra.
2. Confirm required environment variables are present.
3. Confirm Chromium is installed.
4. Run `covra doctor --post-run`.
5. Inspect `.covra/raw/browser` and `.covra/raw/server`.
6. Run `covra report --config <config>` manually if Playwright failed after partial execution.

If the app never serves a healthy URL, fix that first. Covra can only report on flows that Playwright can execute.
