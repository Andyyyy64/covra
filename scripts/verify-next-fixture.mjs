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

const coverage = JSON.parse(readFileSync(coverageFile, 'utf8'))
const meta = JSON.parse(readFileSync(metaFile, 'utf8'))

const clientFile = path.join(fixtureRoot, 'src/ClientCounter.tsx')
const serverFile = path.join(fixtureRoot, 'src/serverGreeting.ts')

assert(coverage[clientFile], 'expected ClientCounter.tsx in coverage-final.json')
assert(coverage[serverFile], 'expected serverGreeting.ts in coverage-final.json')

function findMeta(file) {
  return meta.files.find((entry) => entry.file === file)
}

const clientMeta = findMeta(clientFile)
const serverMeta = findMeta(serverFile)

assert(clientMeta, 'expected ClientCounter.tsx in covra-meta.json')
assert(serverMeta, 'expected serverGreeting.ts in covra-meta.json')
assert(clientMeta.runtimes.includes('browser'), 'expected ClientCounter browser runtime')
assert(clientMeta.runtimes.includes('server'), 'expected ClientCounter server runtime')
assert(serverMeta.runtimes.includes('server'), 'expected serverGreeting server runtime')
assert(clientMeta.sourceMapStatus === 'resolved', 'expected ClientCounter source map to resolve')
assert(serverMeta.sourceMapStatus === 'resolved', 'expected serverGreeting source map to resolve')
assert(meta.confidence === 100, `expected confidence 100, got ${meta.confidence}`)

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

console.log('✓ Next fixture verified: covra start-server + Playwright fixture + report/check/explain')
