import fs from 'node:fs/promises'
import path from 'node:path'
import istanbulReport from 'istanbul-lib-report'
import reports from 'istanbul-reports'
import type { Diagnostic, NormalizedCovraConfig, ReportSpec } from './types.js'

export async function writeCoverageReports(options: {
  config: NormalizedCovraConfig
  coverageMap: unknown
}): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = []
  await fs.mkdir(options.config.outputDir, { recursive: true })

  const context = istanbulReport.createContext({
    dir: options.config.outputDir,
    coverageMap: options.coverageMap,
    defaultSummarizer: 'pkg',
  })

  for (const spec of options.config.reports) {
    const [name, reportOptions] = normalizeReportSpec(spec)

    try {
      reports.create(name, reportOptions).execute(context)
    } catch (error) {
      diagnostics.push({
        level: 'error',
        code: 'report.write.failed',
        message: `Failed to write ${name} coverage report.`,
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const finalJson = path.join(options.config.outputDir, 'coverage-final.json')
  if (!hasReport(options.config.reports, 'json')) {
    await fs.writeFile(finalJson, JSON.stringify((options.coverageMap as any).toJSON(), null, 2))
  }

  return diagnostics
}

function normalizeReportSpec(spec: ReportSpec): [string, Record<string, unknown>] {
  if (Array.isArray(spec)) return [spec[0], spec[1]]
  return [spec, {}]
}

function hasReport(reportsList: ReportSpec[], name: string): boolean {
  return reportsList.some((spec) => (Array.isArray(spec) ? spec[0] : spec) === name)
}
