import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'
import pc from 'picocolors'
import istanbulCoverage from 'istanbul-lib-coverage'
import { loadCovraConfig, findConfigPath } from './config.js'
import { buildCoverageMap } from './convert.js'
import { writeCoverageReports } from './reports.js'
import { checkThresholds, type ThresholdFailure } from './thresholds.js'
import { readMetaFile, writeMetaFile } from './meta.js'
import type { Diagnostic, NormalizedCovraConfig } from './types.js'
import { browserRawDir, serverRawDir } from './artifacts.js'
import { absoluteFromRoot, normalizeCoverageFilePath, relativeToRoot, slash } from './path-utils.js'
import { routeInfoForFile } from './routes.js'
import { buildRouteCoverageRows, printRouteCoverageRows, writeUxDashboard, type RouteCoverageRow } from './route-report.js'

const { createCoverageMap } = istanbulCoverage

export async function reportCommand(options: {
  cwd?: string
  config?: string
  check?: boolean
} = {}): Promise<number> {
  const config = await loadCovraConfig(options)
  await waitForCoverageArtifacts(config)
  const result = await buildCoverageMap(config)

  let diagnostics = [...result.diagnostics]
  await writeMetaFile({
    config,
    diagnostics,
    fileInfo: result.fileInfo,
    routeInfo: result.routeInfo,
  })
  const meta = await readMetaFile(config)
  const routeRows = buildRouteCoverageRows(config, result.coverageMap, meta)

  printDiagnostics(diagnostics)
  printRouteCoverageRows(routeRows)
  printCoverageSummary(config, result.coverageMap, diagnostics)

  const reportDiagnostics = await writeCoverageReports({
    config,
    coverageMap: result.coverageMap,
  })
  diagnostics = [...diagnostics, ...reportDiagnostics]
  printDiagnostics(reportDiagnostics)

  await writeMetaFile({
    config,
    diagnostics,
    fileInfo: result.fileInfo,
    routeInfo: result.routeInfo,
  })
  await writeUxDashboard({
    config,
    coverageMap: result.coverageMap,
    meta: await readMetaFile(config),
  })

  if (options.check) {
    const thresholdResult = checkThresholds(config, result.coverageMap)
    printThresholds(thresholdResult.failures)
    return thresholdResult.passed && diagnostics.every((diagnostic) => diagnostic.level !== 'error') ? 0 : 1
  }

  return diagnostics.some((diagnostic) => diagnostic.level === 'error') ? 1 : 0
}

export async function cleanCommand(options: { cwd?: string; config?: string } = {}): Promise<number> {
  const config = await loadCovraConfig(options)
  await fs.rm(config.rawDir, { recursive: true, force: true })
  await fs.rm(config.outputDir, { recursive: true, force: true })
  await fs.mkdir(browserRawDir(config), { recursive: true })
  await fs.mkdir(serverRawDir(config), { recursive: true })
  console.log(pc.green('cleaned Covra artifacts'))
  console.log(pc.dim(`  raw: ${config.rawDir}`))
  console.log(pc.dim(`  report: ${config.outputDir}`))
  return 0
}

export async function checkCommand(options: {
  cwd?: string
  config?: string
  coverageFile?: string
} = {}): Promise<number> {
  const config = await loadCovraConfig(options)
  const coverageFile = options.coverageFile
    ? path.resolve(config.rootDir, options.coverageFile)
    : path.join(config.outputDir, 'coverage-final.json')

  if (!existsSync(coverageFile)) {
    console.error(pc.red(`Coverage file not found: ${coverageFile}`))
    return 1
  }

  const data = JSON.parse(await fs.readFile(coverageFile, 'utf8'))
  const coverageMap = createCoverageMap(data)
  const result = checkThresholds(config, coverageMap)
  printCoverageSummary(config, coverageMap, [])
  printThresholds(result.failures)
  return result.passed ? 0 : 1
}

export async function doctorCommand(options: { cwd?: string; config?: string; postRun?: boolean } = {}): Promise<number> {
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const configPath = findConfigPath(cwd, options.config)
  const config = await loadCovraConfig(options)
  const diagnostics: Array<{ ok: boolean; message: string; detail?: string }> = []

  diagnostics.push({
    ok: true,
    message: configPath ? 'Covra config found' : 'Covra config not found; defaults will be used',
    detail: configPath,
  })

  const hasNextConfig =
    existsSync(path.join(config.rootDir, 'next.config.ts')) ||
    existsSync(path.join(config.rootDir, 'next.config.js')) ||
    existsSync(path.join(config.rootDir, 'next.config.mjs'))
  diagnostics.push({
    ok: hasNextConfig,
    message: hasNextConfig ? 'Next.js config detected' : 'Next.js config not detected',
  })

  const hasPlaywrightConfig =
    existsSync(path.join(config.rootDir, 'playwright.config.ts')) ||
    existsSync(path.join(config.rootDir, 'playwright.config.js')) ||
    existsSync(path.join(config.rootDir, 'playwright.config.mjs'))
  diagnostics.push({
    ok: hasPlaywrightConfig,
    message: hasPlaywrightConfig ? 'Playwright config detected' : 'Playwright config not detected',
  })

  const includeFiles = await fg(config.include, {
    cwd: config.rootDir,
    ignore: config.exclude,
    onlyFiles: true,
  })
  diagnostics.push({
    ok: includeFiles.length > 0,
    message: `${includeFiles.length} source files matched include/exclude`,
  })

  const browserArtifacts = await fg('**/*.json', {
    cwd: browserRawDir(config),
    onlyFiles: true,
    suppressErrors: true,
  })
  diagnostics.push({
    ok: !options.postRun || browserArtifacts.length > 0,
    message: options.postRun
      ? `${browserArtifacts.length} browser coverage artifacts found`
      : `${browserArtifacts.length} browser coverage artifacts found (optional before a run)`,
    detail: browserRawDir(config),
  })

  const serverArtifacts = await fg('**/*.json', {
    cwd: serverRawDir(config),
    onlyFiles: true,
    suppressErrors: true,
  })
  diagnostics.push({
    ok: !options.postRun || serverArtifacts.length > 0,
    message: options.postRun
      ? `${serverArtifacts.length} server coverage artifacts found`
      : `${serverArtifacts.length} server coverage artifacts found (optional before a run)`,
    detail: serverRawDir(config),
  })

  const sourceMaps = await fg(config.sourceMaps.search, {
    cwd: config.rootDir,
    onlyFiles: true,
    suppressErrors: true,
  })
  diagnostics.push({
    ok: !options.postRun || sourceMaps.length > 0,
    message: options.postRun
      ? `${sourceMaps.length} source maps found`
      : `${sourceMaps.length} source maps found (optional before a coverage build)`,
  })

  console.log(pc.bold('Covra Doctor'))
  console.log('')
  for (const item of diagnostics) {
    console.log(`${item.ok ? pc.green('✓') : pc.yellow('!')} ${item.message}`)
    if (item.detail) console.log(pc.dim(`  ${item.detail}`))
  }
  console.log('')
  console.log(pc.dim('Tip: run `covra report --check` after Playwright finishes to generate CI-ready coverage.'))

  return diagnostics.some((item) => !item.ok) ? 1 : 0
}

export async function explainCommand(file: string, options: { cwd?: string; config?: string } = {}): Promise<number> {
  const config = await loadCovraConfig(options)
  const coverageFile = path.join(config.outputDir, 'coverage-final.json')
  const meta = await readMetaFile(config)

  if (!existsSync(coverageFile)) {
    console.error(pc.red(`Coverage report not found: ${coverageFile}`))
    console.error(pc.dim('Run `covra report` first.'))
    return 1
  }

  const data = JSON.parse(await fs.readFile(coverageFile, 'utf8'))
  const coverageMap = createCoverageMap(data)
  const normalized = normalizeCoverageFilePath(config.rootDir, absoluteFromRoot(config.rootDir, file))

  if (!normalized || !coverageMap.files().includes(normalized)) {
    console.error(pc.red(`File is not present in the coverage report: ${file}`))
    return 1
  }

  const summary = coverageMap.fileCoverageFor(normalized).toSummary().toJSON()
  const fileMeta = meta?.files.find((item) => item.file === normalized)
  const uncovered = uncoveredLines(coverageMap.fileCoverageFor(normalized))

  console.log(pc.bold(relativeToRoot(config.rootDir, normalized)))
  console.log('')
  console.log(`Lines       ${formatPct(summary.lines.pct)}`)
  console.log(`Statements  ${formatPct(summary.statements.pct)}`)
  console.log(`Functions   ${formatPct(summary.functions.pct)}`)
  console.log(`Branches    ${formatPct(summary.branches.pct)}`)
  console.log('')
  console.log(`Runtime     ${fileMeta?.runtimes.join(', ') || 'unknown'}`)
  console.log(`Source map  ${fileMeta?.sourceMapStatus ?? 'unknown'}`)
  const routeRows = buildRouteCoverageRows(config, coverageMap, meta)
  const explainedRoutes = routesForExplainedFile(config, normalized, fileMeta, routeRows)
  const routeMeta = explainedRoutes
    .map((route) => meta?.routes?.find((item) => item.route === route.route))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  if (explainedRoutes.length === 1) {
    const route = explainedRoutes[0]!
    console.log(`Route       ${route.route} (${route.kind})`)
  } else if (explainedRoutes.length > 1) {
    console.log(`Routes      ${explainedRoutes.map((route) => `${route.route} (${route.kind})`).join(', ')}`)
  }

  const uxStates = [...(fileMeta?.uxStates ?? []), ...routeMeta.flatMap((route) => route.uxStates ?? [])]
  if (uxStates.length) {
    console.log(`UX states   ${uniqueStrings(uxStates).join(', ')}`)
  }

  const uiEvents = uniqueStrings(routeMeta.flatMap((route) => route.uiEvents ?? []))
  if (uiEvents.length) {
    console.log(`UI events   ${uiEvents.length}`)
    for (const event of uiEvents.slice(0, 8)) {
      console.log(pc.dim(`  ${event}`))
    }
    if (uiEvents.length > 8) {
      console.log(pc.dim(`  ...and ${uiEvents.length - 8} more`))
    }
  }

  const apiCalls = uniqueStrings(routeMeta.flatMap((route) => route.apiCalls ?? []))
  if (apiCalls.length) {
    console.log(`API calls   ${apiCalls.length}`)
    for (const call of apiCalls.slice(0, 8)) {
      console.log(pc.dim(`  ${call}`))
    }
    if (apiCalls.length > 8) {
      console.log(pc.dim(`  ...and ${apiCalls.length - 8} more`))
    }
  }

  if (fileMeta?.tests?.length) {
    console.log(`Tests       ${fileMeta.tests.length}`)
    for (const test of fileMeta.tests.slice(0, 6)) {
      console.log(pc.dim(`  ${test}`))
    }
    if (fileMeta.tests.length > 6) {
      console.log(pc.dim(`  ...and ${fileMeta.tests.length - 6} more`))
    }
  }

  if (fileMeta?.generatedUrls.length) {
    console.log('')
    console.log(pc.bold('Generated sources'))
    for (const generatedUrl of fileMeta.generatedUrls.slice(0, 8)) {
      console.log(`  ${slash(generatedUrl)}`)
    }
    if (fileMeta.generatedUrls.length > 8) {
      console.log(pc.dim(`  ...and ${fileMeta.generatedUrls.length - 8} more`))
    }
  }

  if (uncovered.length > 0) {
    console.log('')
    console.log(pc.bold('Uncovered lines'))
    console.log(`  ${formatLineRanges(uncovered)}`)
  }

  return 0
}

export async function routesCommand(options: { cwd?: string; config?: string } = {}): Promise<number> {
  const config = await loadCovraConfig(options)
  const coverageFile = path.join(config.outputDir, 'coverage-final.json')
  const meta = await readMetaFile(config)

  if (!existsSync(coverageFile)) {
    console.error(pc.red(`Coverage report not found: ${coverageFile}`))
    console.error(pc.dim('Run `covra report` first.'))
    return 1
  }

  const data = JSON.parse(await fs.readFile(coverageFile, 'utf8'))
  const coverageMap = createCoverageMap(data)
  const rows = buildRouteCoverageRows(config, coverageMap, meta)

  if (rows.length === 0) {
    console.log(pc.yellow('No App Router or Pages Router files were found in the coverage report.'))
    return 0
  }

  printRouteCoverageRows(rows, Number.POSITIVE_INFINITY)
  return 0
}

export async function initCommand(options: { cwd?: string; dryRun?: boolean } = {}): Promise<number> {
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const files = new Map<string, string>([
    [
      'covra.config.ts',
      `import { defineCovraConfig } from 'covra'\n\nexport default defineCovraConfig({\n  framework: 'next',\n  strict: true,\n  collect: {\n    browser: true,\n    server: true,\n  },\n  include: [\n    'app/**/*.{js,jsx,ts,tsx}',\n    'pages/**/*.{js,jsx,ts,tsx}',\n    'src/**/*.{js,jsx,ts,tsx}',\n  ],\n  exclude: [\n    '**/*.test.*',\n    '**/*.spec.*',\n    '**/*.stories.*',\n  ],\n  all: true,\n  reports: ['text-summary', 'html', 'lcov', 'json', 'json-summary'],\n  thresholds: {\n    lines: 80,\n    statements: 80,\n    functions: 75,\n    branches: 70,\n  },\n})\n`,
    ],
    [
      'e2e/covra.fixture.ts',
      `import { test as base, expect } from '@playwright/test'\nimport { covraFixture } from 'covra/playwright'\n\nexport const test = base.extend({\n  ...covraFixture(),\n})\n\nexport { expect }\n`,
    ],
  ])

  for (const [relativePath, content] of files) {
    const fullPath = path.join(cwd, relativePath)
    if (options.dryRun) {
      console.log(pc.bold(relativePath))
      console.log(content)
      continue
    }

    if (existsSync(fullPath)) {
      console.log(pc.yellow(`skip ${relativePath} (already exists)`))
      continue
    }

    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, content)
    console.log(pc.green(`create ${relativePath}`))
  }

  console.log('')
  console.log('Add these integration points:')
  console.log(pc.dim("  next.config.ts: export default withCovra(nextConfig) from 'covra/next'"))
  console.log(pc.dim("  playwright webServer.command: 'COVRA=1 E2E_COVERAGE=1 next build --webpack && covra start-server -- next start'"))
  console.log(pc.dim("  tests: import { test, expect } from './covra.fixture'"))

  return 0
}

export async function startServerCommand(command: string[], options: { cwd?: string; config?: string } = {}): Promise<number> {
  const config = await loadCovraConfig(options)
  const args = stripDashDash(command)
  if (args.length === 0) {
    console.error(pc.red('Usage: covra start-server -- <command>'))
    return 1
  }

  await fs.mkdir(serverRawDir(config), { recursive: true })
  const cmd = args[0]!
  const cmdArgs = args.slice(1)
  const child = spawn(cmd, cmdArgs, {
    cwd: config.rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      COVRA: '1',
      COVRA_COVERAGE: '1',
      E2E_COVERAGE: '1',
      NODE_V8_COVERAGE: serverRawDir(config),
      NODE_OPTIONS: mergeNodeOptions(
        process.env.NODE_OPTIONS,
        '--enable-source-maps',
        `--import=${quoteNodeOptionValue(fileURLToPath(new URL('./server-agent.js', import.meta.url)))}`,
      ),
    },
  })

  const removeSignalHandlers = forwardTerminationTo(child)
  const exitCode = await waitForChild(child)
  removeSignalHandlers()
  return exitCode
}

export async function runCommand(command: string[], options: { cwd?: string; config?: string; check?: boolean } = {}): Promise<number> {
  const config = await loadCovraConfig(options)
  if (!config.debug.keepRaw) {
    await fs.rm(config.rawDir, { recursive: true, force: true })
    await fs.rm(config.outputDir, { recursive: true, force: true })
  }
  const args = stripDashDash(command)
  const actual = args.length > 0 ? args : ['npx', 'playwright', 'test', '--project=chromium']
  const cmd = actual[0]!
  const cmdArgs = actual.slice(1)

  const child = spawn(cmd, cmdArgs, {
    cwd: config.rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      COVRA: '1',
      COVRA_COVERAGE: '1',
      E2E_COVERAGE: '1',
    },
  })

  const testExitCode = await waitForChild(child)
  const reportExitCode = await reportCommand({
    cwd: config.rootDir,
    config: options.config,
    check: options.check ?? true,
  })

  return testExitCode || reportExitCode
}

function printCoverageSummary(config: NormalizedCovraConfig, coverageMap: any, diagnostics: Diagnostic[]): void {
  const summary = coverageMap.getCoverageSummary().toJSON()
  const confidence = Math.max(
    0,
    100 -
      diagnostics.reduce((total, diagnostic) => {
        if (diagnostic.level === 'error') return total + 15
        if (diagnostic.level === 'warn') return total + 4
        return total
      }, 0),
  )

  console.log('')
  console.log(pc.bold('Source Coverage'))
  console.log(`  Lines       ${formatPct(summary.lines.pct)}`)
  console.log(`  Statements  ${formatPct(summary.statements.pct)}`)
  console.log(`  Functions   ${formatPct(summary.functions.pct)}`)
  console.log(`  Branches    ${formatPct(summary.branches.pct)}`)
  console.log(`  Confidence  ${confidence}%`)
  console.log(pc.dim(`  Dashboard   ${path.join(config.outputDir, 'index.html')}`))
}

function printThresholds(failures: ThresholdFailure[]): void {
  if (failures.length === 0) {
    console.log(pc.green('\n✓ Thresholds passed'))
    return
  }

  console.log(pc.red('\n✗ Thresholds failed'))
  for (const failure of failures.slice(0, 20)) {
    const expected =
      failure.mode === 'percent'
        ? `expected ${failure.expected}%`
        : `max uncovered ${Math.abs(failure.expected)}`
    console.log(
      `  ${failure.scope}: ${failure.metric} ${formatPct(failure.actual)} (${expected}, uncovered ${failure.uncovered})`,
    )
  }
}

function printDiagnostics(diagnostics: Diagnostic[]): void {
  const visible = diagnostics.filter((diagnostic) => diagnostic.level !== 'info')
  if (visible.length === 0) return

  console.log(pc.bold('Diagnostics'))
  for (const diagnostic of visible.slice(0, 20)) {
    const color = diagnostic.level === 'error' ? pc.red : pc.yellow
    console.log(`${color(diagnostic.level.toUpperCase())} ${diagnostic.message}`)
    if (diagnostic.detail) console.log(pc.dim(`  ${diagnostic.detail}`))
  }
}

function uncoveredLines(fileCoverage: any): number[] {
  const lines = new Set<number>()
  const statementMap = fileCoverage.statementMap
  for (const [id, count] of Object.entries(fileCoverage.s)) {
    if (Number(count) > 0) continue
    const loc = statementMap[id]
    if (loc?.start?.line) lines.add(loc.start.line)
  }
  return [...lines].sort((a, b) => a - b)
}

function formatLineRanges(lines: number[]): string {
  if (lines.length === 0) return ''
  const ranges: string[] = []
  let start = lines[0]!
  let previous = lines[0]!

  for (const line of lines.slice(1)) {
    if (line === previous + 1) {
      previous = line
      continue
    }
    ranges.push(start === previous ? `${start}` : `${start}-${previous}`)
    start = line
    previous = line
  }

  if (start !== undefined && previous !== undefined) {
    ranges.push(start === previous ? `${start}` : `${start}-${previous}`)
  }

  return ranges.join(', ')
}

function formatPct(value: number): string {
  return `${value.toFixed(2).padStart(6)}%`
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)]
}

type ExplainedRoute = Pick<RouteCoverageRow, 'route' | 'kind'>

function routesForExplainedFile(
  config: NormalizedCovraConfig,
  file: string,
  fileMeta: { generatedUrls?: string[] } | undefined,
  routeRows: RouteCoverageRow[],
): ExplainedRoute[] {
  const routes = new Map<string, ExplainedRoute>()
  const rowsByRoute = new Map(routeRows.map((row) => [row.route, row]))
  const directRoute = routeInfoForFile(config.rootDir, file)

  if (directRoute) {
    routes.set(directRoute.route, directRoute)
  }

  for (const generatedUrl of fileMeta?.generatedUrls ?? []) {
    const route = routeFromGeneratedUrl(generatedUrl)
    if (!route || routes.has(route)) continue
    const row = rowsByRoute.get(route)
    if (row) routes.set(route, { route: row.route, kind: row.kind })
  }

  return [...routes.values()].sort((a, b) => a.route.localeCompare(b.route))
}

function routeFromGeneratedUrl(value: string): string | undefined {
  const normalized = stripUrlSuffix(decodeMaybe(slash(value)))

  const appStatic = normalized.match(/\/_next\/static\/chunks\/app\/(.+)-[^/]+\.js$/)
  if (appStatic?.[1]) return appRouteFromGeneratedPath(appStatic[1])

  const pagesStatic = normalized.match(/\/_next\/static\/chunks\/pages\/(.+)-[^/]+\.js$/)
  if (pagesStatic?.[1]) return pagesRouteFromGeneratedPath(pagesStatic[1])

  const serverAppToken = '/.next/server/app/'
  const serverAppIndex = normalized.indexOf(serverAppToken)
  if (serverAppIndex >= 0) {
    return appRouteFromGeneratedPath(normalized.slice(serverAppIndex + serverAppToken.length).replace(/\.js$/, ''))
  }

  const serverPagesToken = '/.next/server/pages/'
  const serverPagesIndex = normalized.indexOf(serverPagesToken)
  if (serverPagesIndex >= 0) {
    return pagesRouteFromGeneratedPath(normalized.slice(serverPagesIndex + serverPagesToken.length).replace(/\.js$/, ''))
  }

  return undefined
}

function appRouteFromGeneratedPath(value: string): string | undefined {
  const parts = value.split('/').filter(Boolean)
  const endpoint = parts.at(-1)
  const routeParts = endpoint && ['page', 'route', 'layout', 'template', 'default'].includes(endpoint)
    ? parts.slice(0, -1)
    : parts
  const publicParts = routeParts.filter((part) => !part.startsWith('(') && !part.startsWith('@'))
  return routeFromSegments(publicParts)
}

function pagesRouteFromGeneratedPath(value: string): string | undefined {
  const parts = value.split('/').filter(Boolean)
  if (parts.length === 0) return '/'
  if (parts.some((part) => part.startsWith('_'))) return undefined
  const basename = parts.at(-1)
  const routeParts = basename === 'index' ? parts.slice(0, -1) : parts
  return routeFromSegments(routeParts)
}

function routeFromSegments(segments: string[]): string {
  return `/${segments.filter(Boolean).join('/')}`.replace(/\/+$/, '') || '/'
}

function stripUrlSuffix(value: string): string {
  return value.split('#')[0]!.split('?')[0]!
}

function decodeMaybe(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function stripDashDash(command: string[]): string[] {
  return command[0] === '--' ? command.slice(1) : command
}

function mergeNodeOptions(current: string | undefined, ...options: string[]): string {
  const parts = current ? current.split(/\s+/).filter(Boolean) : []
  for (const option of options) {
    if (!parts.includes(option)) parts.push(option)
  }
  return parts.join(' ')
}

function quoteNodeOptionValue(value: string): string {
  return /\s/.test(value) ? JSON.stringify(value) : value
}

async function waitForChild(child: ReturnType<typeof spawn>): Promise<number> {
  return await new Promise((resolve) => {
    child.on('exit', (code, signal) => {
      if (signal) resolve(1)
      else resolve(code ?? 0)
    })
  })
}

async function waitForCoverageArtifacts(config: NormalizedCovraConfig): Promise<void> {
  const deadline = Date.now() + config.collect.server.teardownWaitMs
  while (Date.now() < deadline) {
    const missingServer =
      config.collect.server.enabled &&
      (await fg('**/*.json', {
        cwd: serverRawDir(config),
        onlyFiles: true,
        suppressErrors: true,
      })).length === 0

    if (!missingServer) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

function forwardTerminationTo(child: ReturnType<typeof spawn>): () => void {
  const onTerminate = (signal: NodeJS.Signals) => {
    if (!child.killed) {
      child.kill(signal)
    }
  }

  process.once('SIGTERM', onTerminate)
  process.once('SIGINT', onTerminate)

  return () => {
    process.off('SIGTERM', onTerminate)
    process.off('SIGINT', onTerminate)
  }
}
