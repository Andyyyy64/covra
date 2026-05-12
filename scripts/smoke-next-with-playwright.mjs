import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const smokeRoot = process.env.COVRA_SMOKE_DIR || path.join(realpathSync(os.tmpdir()), 'covra-next-with-playwright-smoke')
const repoRoot = path.join(smokeRoot, 'next.js')
const projectRoot = path.join(repoRoot, 'examples/with-playwright')
const port = Number(process.env.COVRA_SMOKE_PORT || 3217)

const rootNodeModules = path.join(root, 'node_modules')
const covraCli = path.join(root, 'dist/cli.js')
const nextBin = path.join(rootNodeModules, 'next/dist/bin/next')
const playwrightCli = path.join(rootNodeModules, '@playwright/test/cli.js')

function fail(message) {
  console.error(`Covra external smoke failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    env: {
      ...process.env,
      ...options.env,
      CI: '1',
    },
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    fail(`${command} ${args.join(' ')} exited with ${result.status}`)
  }
}

function slash(value) {
  return value.replace(/\\/g, '/')
}

function shellQuote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`
}

function writeProjectFile(relativePath, content) {
  const file = path.join(projectRoot, relativePath)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, content)
}

assert(existsSync(covraCli), 'dist/cli.js is missing; run npm run build first')
assert(existsSync(rootNodeModules), 'node_modules is missing; run npm ci first')

rmSync(smokeRoot, { recursive: true, force: true })
mkdirSync(smokeRoot, { recursive: true })

run('git', [
  'clone',
  '--depth',
  '1',
  '--filter=blob:none',
  '--sparse',
  'https://github.com/vercel/next.js.git',
  repoRoot,
])
run('git', ['sparse-checkout', 'set', 'examples/with-playwright'], { cwd: repoRoot })

const projectNodeModules = path.join(projectRoot, 'node_modules')
const covraNodeModule = path.join(rootNodeModules, 'covra')
rmSync(covraNodeModule, { recursive: true, force: true })
symlinkSync(root, covraNodeModule, 'dir')

if (!existsSync(projectNodeModules)) {
  symlinkSync(rootNodeModules, projectNodeModules, 'dir')
}

writeProjectFile(
  'next.config.mjs',
  `import { withCovra } from 'covra/next'\n\nexport default withCovra({})\n`,
)

writeProjectFile(
  'covra.config.mjs',
  `import { defineCovraConfig } from 'covra'\n\nexport default defineCovraConfig({\n  framework: 'next',\n  rootDir: '.',\n  collect: {\n    browser: true,\n    server: true,\n  },\n  include: [\n    'app/**/*.{js,jsx,ts,tsx}',\n    'pages/**/*.{js,jsx,ts,tsx}',\n  ],\n  exclude: [\n    '**/*.test.*',\n    '**/*.spec.*',\n  ],\n  all: true,\n  reports: ['text-summary', 'html', 'lcov', 'json', 'json-summary'],\n  thresholds: {\n    lines: 1,\n    statements: 1,\n    functions: 0,\n    branches: -200,\n  },\n})\n`,
)

const smokeTestDir = path.join(projectRoot, '.covra-smoke/e2e')
mkdirSync(smokeTestDir, { recursive: true })
writeFileSync(
  path.join(smokeTestDir, 'covra.fixture.ts'),
  `import { test as base, expect } from '@playwright/test'\nimport { covraFixture } from 'covra/playwright'\n\nexport const test = base.extend({\n  ...covraFixture(),\n})\n\nexport { expect }\n`,
)

for (const file of ['app.spec.ts', 'pages.spec.ts']) {
  const source = readFileSync(path.join(projectRoot, 'e2e', file), 'utf8')
  writeFileSync(
    path.join(smokeTestDir, file),
    source.replace(/from ["']@playwright\/test["']/, 'from "./covra.fixture"'),
  )
}

const webServerCommand = [
  'COVRA=1 COVRA_COVERAGE=1 E2E_COVERAGE=1',
  'node',
  shellQuote(slash(nextBin)),
  'build',
  '--webpack',
  '&&',
  'node',
  shellQuote(slash(covraCli)),
  'start-server',
  '--config',
  'covra.config.mjs',
  '--',
  'node',
  shellQuote(slash(nextBin)),
  'start',
  '-p',
  String(port),
].join(' ')

writeProjectFile(
  'covra.playwright.config.ts',
  `import { defineConfig, devices } from '@playwright/test'\n\nexport default defineConfig({\n  testDir: './.covra-smoke/e2e',\n  fullyParallel: true,\n  workers: 2,\n  reporter: [['list']],\n  use: {\n    baseURL: 'http://127.0.0.1:${port}',\n    trace: 'off',\n  },\n  projects: [\n    {\n      name: 'chromium',\n      use: { ...devices['Desktop Chrome'] },\n    },\n  ],\n  webServer: {\n    command: ${JSON.stringify(webServerCommand)},\n    url: 'http://127.0.0.1:${port}',\n    reuseExistingServer: false,\n    timeout: 120_000,\n  },\n})\n`,
)

run('node', [covraCli, 'clean', '--config', 'covra.config.mjs'], { cwd: projectRoot })
run('node', [playwrightCli, 'test', '--config', 'covra.playwright.config.ts'], { cwd: projectRoot })
run('node', [covraCli, 'doctor', '--post-run', '--config', 'covra.config.mjs'], { cwd: projectRoot })
run('node', [covraCli, 'report', '--config', 'covra.config.mjs'], { cwd: projectRoot })
run('node', [covraCli, 'check', '--config', 'covra.config.mjs'], { cwd: projectRoot })
run('node', [covraCli, 'routes', '--config', 'covra.config.mjs'], { cwd: projectRoot })

const explainApp = execFileSync('node', [covraCli, 'explain', 'app/page.tsx', '--config', 'covra.config.mjs'], {
  cwd: projectRoot,
  encoding: 'utf8',
})
const explainPages = execFileSync('node', [covraCli, 'explain', 'pages/home/index.tsx', '--config', 'covra.config.mjs'], {
  cwd: projectRoot,
  encoding: 'utf8',
})

assert(explainApp.includes('Source map  resolved'), 'expected app/page.tsx source map to resolve')
assert(explainPages.includes('Source map  resolved'), 'expected pages/home/index.tsx source map to resolve')

const coverage = JSON.parse(readFileSync(path.join(projectRoot, 'coverage/covra/coverage-final.json'), 'utf8'))
const meta = JSON.parse(readFileSync(path.join(projectRoot, 'coverage/covra/covra-meta.json'), 'utf8'))
const routeCoverage = JSON.parse(readFileSync(path.join(projectRoot, 'coverage/covra/route-coverage.json'), 'utf8'))
const dashboard = readFileSync(path.join(projectRoot, 'coverage/covra/index.html'), 'utf8')

for (const relativeFile of ['app/page.tsx', 'app/about/page.tsx', 'pages/home/index.tsx', 'pages/home/about.tsx']) {
  const absoluteFile = path.join(projectRoot, relativeFile)
  assert(coverage[absoluteFile], `expected ${relativeFile} in external smoke coverage`)
  const fileMeta = meta.files.find((entry) => entry.file === absoluteFile)
  assert(fileMeta, `expected ${relativeFile} in external smoke meta`)
  assert(fileMeta.sourceMapStatus === 'resolved', `expected ${relativeFile} source map to resolve`)
}

assert(meta.confidence === 100, `expected external smoke confidence 100, got ${meta.confidence}`)
assert(dashboard.includes('E2E UX Coverage'), 'expected external smoke dashboard to be the main report')
assert(
  routeCoverage.routes.some((route) => route.route === '/' && route.kind === 'app-page'),
  'expected external smoke route coverage to include App Router home page',
)
assert(
  routeCoverage.routes.some((route) => route.route === '/home' && route.kind === 'pages-page'),
  'expected external smoke route coverage to include Pages Router home page',
)

console.log('✓ External smoke verified: vercel/next.js examples/with-playwright + Covra E2E UX route dashboard')
