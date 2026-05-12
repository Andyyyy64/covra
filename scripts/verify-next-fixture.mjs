import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const fixtureRoot = path.join(root, 'fixtures/next-app-router')
const rawBrowserDir = path.join(fixtureRoot, '.covra/raw/browser')
const rawServerDir = path.join(fixtureRoot, '.covra/raw/server')
const reportDir = path.join(fixtureRoot, 'coverage/covra')
const coverageFile = path.join(reportDir, 'coverage-final.json')
const metaFile = path.join(reportDir, 'covra-meta.json')
const routeCoverageFile = path.join(reportDir, 'route-coverage.json')
const dashboardFile = path.join(reportDir, 'index.html')

function fail(message) {
  console.error(`Covra fixture verification failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function listJsonFiles(dir) {
  assert(existsSync(dir), `missing directory: ${path.relative(root, dir)}`)
  return readdirSync(dir).filter((file) => file.endsWith('.json'))
}

const browserArtifacts = listJsonFiles(rawBrowserDir)
const serverArtifacts = listJsonFiles(rawServerDir)
assert(browserArtifacts.length >= 2, 'expected browser V8 coverage artifacts from parallel Playwright workers')
assert(serverArtifacts.length > 0, 'expected server NODE_V8_COVERAGE artifacts')

assert(existsSync(coverageFile), 'expected coverage-final.json')
assert(existsSync(metaFile), 'expected covra-meta.json')
assert(existsSync(routeCoverageFile), 'expected route-coverage.json')
assert(existsSync(dashboardFile), 'expected E2E UX dashboard index.html')

const coverage = JSON.parse(readFileSync(coverageFile, 'utf8'))
const meta = JSON.parse(readFileSync(metaFile, 'utf8'))
const routeCoverage = JSON.parse(readFileSync(routeCoverageFile, 'utf8'))
const dashboard = readFileSync(dashboardFile, 'utf8')

const clientFile = path.join(fixtureRoot, 'src/ClientCounter.tsx')
const serverFile = path.join(fixtureRoot, 'src/serverGreeting.ts')
const pagesFile = path.join(fixtureRoot, 'pages/legacy.tsx')
const pagesApiFile = path.join(fixtureRoot, 'pages/api/legacy.ts')
const pagesGreetingFile = path.join(fixtureRoot, 'src/pagesGreeting.ts')

assert(coverage[clientFile], 'expected ClientCounter.tsx in coverage-final.json')
assert(coverage[serverFile], 'expected serverGreeting.ts in coverage-final.json')
assert(coverage[pagesFile], 'expected pages/legacy.tsx in coverage-final.json')
assert(coverage[pagesApiFile], 'expected pages/api/legacy.ts in coverage-final.json')
assert(coverage[pagesGreetingFile], 'expected pagesGreeting.ts in coverage-final.json')

function findMeta(file) {
  return meta.files.find((entry) => entry.file === file)
}

const clientMeta = findMeta(clientFile)
const serverMeta = findMeta(serverFile)
const pagesMeta = findMeta(pagesFile)
const pagesApiMeta = findMeta(pagesApiFile)
const pagesGreetingMeta = findMeta(pagesGreetingFile)

assert(clientMeta, 'expected ClientCounter.tsx in covra-meta.json')
assert(serverMeta, 'expected serverGreeting.ts in covra-meta.json')
assert(pagesMeta, 'expected pages/legacy.tsx in covra-meta.json')
assert(pagesApiMeta, 'expected pages/api/legacy.ts in covra-meta.json')
assert(pagesGreetingMeta, 'expected pagesGreeting.ts in covra-meta.json')
assert(clientMeta.runtimes.includes('browser'), 'expected ClientCounter browser runtime')
assert(clientMeta.runtimes.includes('server'), 'expected ClientCounter server runtime')
assert(serverMeta.runtimes.includes('server'), 'expected serverGreeting server runtime')
assert(pagesMeta.runtimes.includes('browser'), 'expected pages/legacy browser runtime')
assert(pagesMeta.runtimes.includes('server'), 'expected pages/legacy server runtime')
assert(pagesApiMeta.runtimes.includes('server'), 'expected pages/api/legacy server runtime')
assert(pagesGreetingMeta.runtimes.includes('server'), 'expected pagesGreeting server runtime')
assert(clientMeta.sourceMapStatus === 'resolved', 'expected ClientCounter source map to resolve')
assert(serverMeta.sourceMapStatus === 'resolved', 'expected serverGreeting source map to resolve')
assert(pagesMeta.sourceMapStatus === 'resolved', 'expected pages/legacy source map to resolve')
assert(pagesApiMeta.sourceMapStatus === 'resolved', 'expected pages/api/legacy source map to resolve')
assert(pagesGreetingMeta.sourceMapStatus === 'resolved', 'expected pagesGreeting source map to resolve')
assert(pagesMeta.route === '/legacy', 'expected pages/legacy route metadata')
assert(pagesMeta.routeKind === 'pages-page', 'expected pages/legacy route kind')
assert(pagesApiMeta.route === '/api/legacy', 'expected pages/api/legacy route metadata')
assert(pagesApiMeta.routeKind === 'pages-api', 'expected pages/api/legacy route kind')
assert(pagesMeta.uxStates.includes('ssr.loaded'), 'expected pages/legacy UX loaded state')
assert(pagesMeta.uxStates.includes('modal-or-state.clicked'), 'expected pages/legacy UX clicked state')
assert(meta.confidence === 100, `expected confidence 100, got ${meta.confidence}`)

assert(dashboard.includes('E2E UX Coverage'), 'expected dashboard to be the main index.html')
assert(dashboard.includes('/legacy'), 'expected dashboard to include /legacy route')
assert(routeCoverage.totals.routes >= 4, 'expected route coverage summary to include app/pages routes')
assert(
  routeCoverage.routes.some((route) => route.route === '/legacy' && route.kind === 'pages-page'),
  'expected route-coverage.json to include /legacy pages-page',
)
assert(
  routeCoverage.routes.some((route) => route.route === '/api/legacy' && route.kind === 'pages-api'),
  'expected route-coverage.json to include /api/legacy pages-api',
)

const explainClient = execFileSync(
  'node',
  ['dist/cli.js', 'explain', 'src/ClientCounter.tsx', '--config', 'fixtures/next-app-router/covra.config.ts'],
  { cwd: root, encoding: 'utf8' },
)
const explainServer = execFileSync(
  'node',
  ['dist/cli.js', 'explain', 'src/serverGreeting.ts', '--config', 'fixtures/next-app-router/covra.config.ts'],
  { cwd: root, encoding: 'utf8' },
)
const explainPages = execFileSync(
  'node',
  ['dist/cli.js', 'explain', 'pages/legacy.tsx', '--config', 'fixtures/next-app-router/covra.config.ts'],
  { cwd: root, encoding: 'utf8' },
)
const routesOutput = execFileSync(
  'node',
  ['dist/cli.js', 'routes', '--config', 'fixtures/next-app-router/covra.config.ts'],
  { cwd: root, encoding: 'utf8' },
)

assert(
  explainClient.includes('Runtime     browser, server, merged'),
  'expected explain output to show browser, server, merged for ClientCounter',
)
assert(
  explainClient.includes('Source map  resolved'),
  'expected explain output to show resolved source map for ClientCounter',
)
assert(
  explainServer.includes('Runtime     server, merged'),
  'expected explain output to show server, merged for serverGreeting',
)
assert(
  explainServer.includes('Source map  resolved'),
  'expected explain output to show resolved source map for serverGreeting',
)
assert(
  explainPages.includes('Runtime     browser, server, merged'),
  'expected explain output to show browser, server, merged for pages/legacy',
)
assert(
  explainPages.includes('Source map  resolved'),
  'expected explain output to show resolved source map for pages/legacy',
)
assert(
  explainPages.includes('Route       /legacy (pages-page)'),
  'expected explain output to show route mapping for pages/legacy',
)
assert(
  explainPages.includes('UX states   ssr.loaded, modal-or-state.clicked'),
  'expected explain output to show UX states for pages/legacy',
)
assert(routesOutput.includes('Route Coverage'), 'expected routes command to print route coverage')
assert(routesOutput.includes('/legacy'), 'expected routes command to include /legacy')
assert(routesOutput.includes('/api/legacy'), 'expected routes command to include /api/legacy')

console.log('✓ Next fixture verified: app/pages router + E2E UX dashboard + covra routes/report/check/explain')
