import fs from 'node:fs/promises'
import path from 'node:path'
import pc from 'picocolors'
import type { NormalizedCovraConfig } from './types.js'
import type { CovraMetaFile } from './meta.js'
import { routeInfoForFile, routeSortKey, type RouteInfo } from './routes.js'
import { relativeToRoot, slash } from './path-utils.js'

export type RouteCoverageRow = {
  route: string
  kind: RouteInfo['kind']
  file: string
  displayFile: string
  observed: boolean
  flow: CoverageMetricSummary
  lines: CoverageMetricSummary
  branches: CoverageMetricSummary
  statements: CoverageMetricSummary
  functions: CoverageMetricSummary
  runtimes: string[]
  sourceMapStatus: string
  tests: string[]
  uxStates: string[]
  uiEvents: string[]
  apiCalls: string[]
  sourceHtmlPath: string
}

type CoverageMetricSummary = {
  pct: number
  total: number
  covered: number
}

export type RouteCoverageReport = {
  version: 1
  createdAt: string
  confidence?: number
  totals: {
    routes: number
    observedRoutes: number
    routeCoveragePct: number
    withBrowserRuntime: number
    withServerRuntime: number
    withUxStates: number
    withUiEvents: number
    withApiCalls: number
    branchGaps: number
  }
  routes: RouteCoverageRow[]
}

export function buildRouteCoverageRows(
  config: NormalizedCovraConfig,
  coverageMap: any,
  meta?: Pick<CovraMetaFile, 'files' | 'routes'>,
): RouteCoverageRow[] {
  const metaByFile = new Map((meta?.files ?? []).map((file) => [file.file, file]))
  const metaByRoute = new Map((meta?.routes ?? []).map((route) => [route.route, route]))

  return coverageMap
    .files()
    .map((file: string): RouteCoverageRow | undefined => {
      const routeInfo = routeInfoForFile(config.rootDir, file)
      if (!routeInfo) return undefined
      if (!isPrimaryRouteKind(routeInfo.kind)) return undefined

      const summary = coverageMap.fileCoverageFor(file).toSummary().toJSON()
      const metaFile = metaByFile.get(file)
      const metaRoutes = routeMetaForRoute(routeInfo.route, metaByRoute)
      const displayFile = relativeToRoot(config.rootDir, file)
      const routeTests = unique(metaRoutes.flatMap((route) => route.tests))
      const tests = unique([...(metaFile?.tests ?? []), ...routeTests])
      const uxStates = unique([...(metaFile?.uxStates ?? []), ...metaRoutes.flatMap((route) => route.uxStates)])
      const uiEvents = unique(metaRoutes.flatMap((route) => route.uiEvents ?? []))
      const apiCalls = unique(metaRoutes.flatMap((route) => route.apiCalls ?? []))
      const runtimes = unique([...(metaFile?.runtimes ?? []), ...metaRoutes.flatMap((route) => route.runtimes ?? [])])
      const observed = routeTests.length > 0 || uxStates.length > 0 || uiEvents.length > 0 || apiCalls.length > 0

      return {
        route: routeInfo.route,
        kind: routeInfo.kind,
        file,
        displayFile,
        observed,
        flow: {
          pct: observed ? 100 : 0,
          covered: observed ? 1 : 0,
          total: 1,
        },
        lines: summary.lines,
        branches: summary.branches,
        statements: summary.statements,
        functions: summary.functions,
        runtimes,
        sourceMapStatus: metaFile?.sourceMapStatus ?? 'unknown',
        tests,
        uxStates,
        uiEvents,
        apiCalls,
        sourceHtmlPath: `${slash(displayFile)}.html`,
      }
    })
    .filter((row: RouteCoverageRow | undefined): row is RouteCoverageRow => Boolean(row))
    .sort((a: RouteCoverageRow, b: RouteCoverageRow) =>
      routeSortKey({ route: a.route, kind: a.kind }).localeCompare(routeSortKey({ route: b.route, kind: b.kind })),
    )
}

function isPrimaryRouteKind(kind: RouteInfo['kind']): boolean {
  return kind === 'app-page' || kind === 'app-route' || kind === 'pages-page' || kind === 'pages-api'
}

function routeMetaForRoute(
  route: string,
  metaByRoute: Map<string, { runtimes?: string[]; tests: string[]; uxStates: string[]; uiEvents?: string[]; apiCalls?: string[] }>,
): Array<{ runtimes?: string[]; tests: string[]; uxStates: string[]; uiEvents?: string[]; apiCalls?: string[] }> {
  const aliases = routeAliases(route)
  const matches: Array<{ runtimes?: string[]; tests: string[]; uxStates: string[]; uiEvents?: string[]; apiCalls?: string[] }> = []

  for (const alias of aliases) {
    const meta = metaByRoute.get(alias)
    if (meta) matches.push(meta)
  }

  return matches
}

function routeAliases(route: string): string[] {
  const aliases = new Set([route])
  const parts = route.split('/').filter(Boolean)

  if (parts[0]?.startsWith('[') && parts[0].endsWith(']')) {
    aliases.add(parts.length === 1 ? '/' : `/${parts.slice(1).join('/')}`)
  }

  return [...aliases]
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b))
}

export async function writeUxDashboard(options: {
  config: NormalizedCovraConfig
  coverageMap: any
  meta?: CovraMetaFile
}): Promise<RouteCoverageReport> {
  const rows = buildRouteCoverageRows(options.config, options.coverageMap, options.meta)
  const observedRoutes = rows.filter((row) => row.observed).length
  const report: RouteCoverageReport = {
    version: 1,
    createdAt: new Date().toISOString(),
    confidence: options.meta?.confidence,
    totals: {
      routes: rows.length,
      observedRoutes,
      routeCoveragePct: rows.length === 0 ? 100 : Number(((observedRoutes / rows.length) * 100).toFixed(1)),
      withBrowserRuntime: rows.filter((row) => row.runtimes.includes('browser')).length,
      withServerRuntime: rows.filter((row) => row.runtimes.includes('server')).length,
      withUxStates: rows.filter((row) => row.uxStates.length > 0).length,
      withUiEvents: rows.filter((row) => row.uiEvents.length > 0).length,
      withApiCalls: rows.filter((row) => row.apiCalls.length > 0).length,
      branchGaps: rows.filter((row) => row.branches.covered < row.branches.total).length,
    },
    routes: rows,
  }

  await fs.mkdir(options.config.outputDir, { recursive: true })
  await fs.writeFile(path.join(options.config.outputDir, 'route-coverage.json'), JSON.stringify(report, null, 2))
  const html = renderDashboard(report)
  await fs.writeFile(path.join(options.config.outputDir, 'dashboard.html'), html)
  await fs.writeFile(path.join(options.config.outputDir, 'index.html'), html)

  return report
}

export function printRouteCoverageRows(rows: RouteCoverageRow[], limit = 20): void {
  if (rows.length === 0) return

  console.log('')
  console.log(pc.bold('Route Coverage'))
  console.log(
    [
      'Route'.padEnd(18),
      'Kind'.padEnd(13),
      'E2E flow'.padEnd(12),
      'Lines'.padEnd(18),
      'Branches'.padEnd(18),
      'Runtime'.padEnd(22),
      'UX states'.padEnd(9),
      'UI events'.padEnd(9),
      'API calls'.padEnd(9),
      'File',
    ].join('  '),
  )

  for (const row of rows.slice(0, limit)) {
    console.log(
      [
        row.route.padEnd(18),
        row.kind.padEnd(13),
        formatFlow(row).padEnd(12),
        formatMetric(row.lines).padEnd(18),
        formatMetric(row.branches).padEnd(18),
        (row.runtimes.join(', ') || 'unknown').padEnd(22),
        String(row.uxStates.length).padEnd(9),
        String(row.uiEvents.length).padEnd(9),
        String(row.apiCalls.length).padEnd(9),
        slash(row.displayFile),
      ].join('  '),
    )
  }
}

function renderDashboard(report: RouteCoverageReport): string {
  const pageRows = report.routes.map(renderRouteRow).join('\n')
  const worstRoutes = [...report.routes]
    .filter((row) => !row.observed || row.branches.covered < row.branches.total)
    .sort((a, b) => a.flow.pct - b.flow.pct || a.branches.pct - b.branches.pct || a.lines.pct - b.lines.pct)
    .slice(0, 6)
    .map((row) => `<li><span>${escapeHtml(row.route)}</span><strong>${escapeHtml(formatFlow(row))}</strong></li>`)
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Covra E2E UX Coverage</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f8fa;
      --panel: #ffffff;
      --text: #18202a;
      --muted: #687385;
      --line: #d8dee8;
      --accent: #0f766e;
      --accent-soft: #dff7f2;
      --warn: #a16207;
      --warn-soft: #fef3c7;
      --bad: #b91c1c;
      --bad-soft: #fee2e2;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); }
    main { width: min(1280px, calc(100% - 40px)); margin: 0 auto; padding: 32px 0 48px; }
    header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; margin-bottom: 24px; }
    h1 { margin: 0 0 6px; font-size: 30px; line-height: 1.15; letter-spacing: 0; }
    p { margin: 0; color: var(--muted); }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .meta { text-align: right; color: var(--muted); font-size: 13px; }
    .cards { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
    .card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 16px; }
    .card span { display: block; color: var(--muted); font-size: 12px; margin-bottom: 8px; }
    .card strong { display: block; font-size: 24px; line-height: 1; }
    .layout { display: grid; grid-template-columns: 1fr 320px; gap: 16px; align-items: start; }
    .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
    .panel h2 { margin: 0; padding: 16px 18px; border-bottom: 1px solid var(--line); font-size: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { color: var(--muted); font-weight: 600; text-align: left; background: #fbfcfd; }
    th, td { padding: 12px 14px; border-bottom: 1px solid var(--line); vertical-align: top; }
    tr:last-child td { border-bottom: 0; }
    .route { font-weight: 700; font-size: 14px; }
    .kind { color: var(--muted); font-size: 12px; margin-top: 3px; }
    .metric { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }
    .bar { width: 74px; height: 8px; border-radius: 99px; background: #e6ebf2; overflow: hidden; }
    .bar i { display: block; height: 100%; background: var(--accent); }
    .bar.warn i { background: var(--warn); }
    .bar.bad i { background: var(--bad); }
    .runtime, .chip { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 3px 8px; margin: 0 4px 5px 0; font-size: 12px; color: #364152; background: #fff; }
    .chip { background: var(--accent-soft); border-color: #a9e5da; color: #0f5f59; }
    .muted { color: var(--muted); }
    .side { padding: 16px 18px; }
    .side ol { margin: 0; padding-left: 20px; }
    .side li { margin: 0 0 12px; color: var(--muted); }
    .side li span { display: block; color: var(--text); font-weight: 650; }
    .side li strong { font-weight: 600; color: var(--warn); }
    .actions { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
    .button { display: inline-flex; align-items: center; height: 34px; padding: 0 12px; border-radius: 6px; border: 1px solid var(--line); background: #fff; color: var(--text); font-size: 13px; }
    @media (max-width: 980px) {
      main { width: min(100% - 24px, 900px); padding-top: 24px; }
      header { display: block; }
      .meta { text-align: left; margin-top: 12px; }
      .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .layout { grid-template-columns: 1fr; }
      .panel { overflow-x: auto; }
      table { min-width: 900px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>E2E UX Coverage</h1>
        <p>Route-first coverage for real Playwright user flows. Istanbul details remain available for source-level inspection.</p>
      </div>
      <div class="meta">
        <div>Generated ${escapeHtml(new Date(report.createdAt).toLocaleString())}</div>
        <div>Confidence ${report.confidence ?? 'unknown'}%</div>
      </div>
    </header>
    <section class="cards">
      ${renderCard('E2E route coverage', `${report.totals.observedRoutes}/${report.totals.routes}`)}
      ${renderCard('Browser runtime', report.totals.withBrowserRuntime)}
      ${renderCard('Server runtime', report.totals.withServerRuntime)}
      ${renderCard('UX states', report.totals.withUxStates)}
      ${renderCard('API calls', report.totals.withApiCalls)}
      ${renderCard('Branch gaps', report.totals.branchGaps)}
    </section>
    <section class="layout">
      <div class="panel">
        <h2>Routes and UX Surfaces</h2>
        <table>
          <thead>
            <tr>
              <th>Route</th>
              <th>E2E flow</th>
              <th>Lines</th>
              <th>Branches</th>
              <th>Runtime</th>
              <th>Observed UX signals</th>
              <th>API calls</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            ${pageRows}
          </tbody>
        </table>
      </div>
      <aside class="panel">
        <h2>Uncovered UX Surfaces</h2>
        <div class="side">
          <ol>
            ${worstRoutes || '<li><span>All routes observed</span><strong>100%</strong></li>'}
          </ol>
          <p>E2E flow is based on observed top-level navigations, API requests, UI interactions, DOM states, and optional manual UX states. Source lines remain available as a secondary signal.</p>
          <div class="actions">
            <a class="button" href="route-coverage.json">Route JSON</a>
            <a class="button" href="lcov-report/index.html">LCOV HTML</a>
          </div>
        </div>
      </aside>
    </section>
  </main>
</body>
</html>`
}

function renderCard(label: string, value: string | number): string {
  return `<div class="card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`
}

function renderRouteRow(row: RouteCoverageRow): string {
  return `<tr>
    <td><div class="route">${escapeHtml(row.route)}</div><div class="kind">${escapeHtml(row.kind)}</div></td>
    <td>${renderMetric(row.flow)}</td>
    <td>${renderMetric(row.lines)}</td>
    <td>${renderMetric(row.branches)}</td>
    <td>${renderRuntime(row.runtimes)}</td>
    <td>${renderSignals(row)}</td>
    <td>${renderApiCalls(row.apiCalls)}</td>
    <td><a href="${escapeHtml(row.sourceHtmlPath)}">${escapeHtml(row.displayFile)}</a><div class="muted">${escapeHtml(row.sourceMapStatus)}</div></td>
  </tr>`
}

function renderMetric(metric: CoverageMetricSummary): string {
  const pct = Number.isFinite(metric.pct) ? metric.pct : 100
  const tone = pct < 60 ? 'bad' : pct < 85 ? 'warn' : ''
  return `<span class="metric"><span class="bar ${tone}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></span>${escapeHtml(formatMetric(metric))}</span>`
}

function renderRuntime(runtimes: string[]): string {
  return runtimes.length > 0
    ? runtimes.map((runtime) => `<span class="runtime">${escapeHtml(runtime)}</span>`).join('')
    : '<span class="muted">unknown</span>'
}

function renderSignals(row: RouteCoverageRow): string {
  const signals = unique([...row.uxStates, ...row.uiEvents])
  const chips = signals.slice(0, 8).map((state) => `<span class="chip">${escapeHtml(state)}</span>`).join('')
  const overflow = signals.length > 8 ? `<span class="muted">+${signals.length - 8} more</span>` : ''
  const testsText = row.tests.length > 0 ? `<div class="muted">${row.tests.length} test${row.tests.length === 1 ? '' : 's'}</div>` : ''
  return chips || testsText ? `${chips}${overflow}${testsText}` : '<span class="muted">No UI signals</span>'
}

function renderApiCalls(apiCalls: string[]): string {
  if (apiCalls.length === 0) return '<span class="muted">none</span>'
  const chips = apiCalls.slice(0, 6).map((call) => `<span class="runtime">${escapeHtml(call)}</span>`).join('')
  const overflow = apiCalls.length > 6 ? `<span class="muted">+${apiCalls.length - 6} more</span>` : ''
  return `${chips}${overflow}`
}

function formatMetric(metric: CoverageMetricSummary): string {
  return `${metric.pct.toFixed(1)}% (${metric.covered}/${metric.total})`
}

function formatFlow(row: RouteCoverageRow): string {
  return row.observed ? 'covered' : 'missing'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
