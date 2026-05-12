import micromatch from 'micromatch'
import type { CoverageMetric, NormalizedCovraConfig, ThresholdBlock } from './types.js'
import { relativeToRoot } from './path-utils.js'

const metrics: CoverageMetric[] = ['lines', 'statements', 'functions', 'branches']
const reservedKeys = new Set<string>([...metrics, 'perFile', '100'])

export type ThresholdFailure = {
  scope: string
  metric: CoverageMetric
  expected: number
  actual: number
  uncovered: number
  mode: 'percent' | 'uncovered'
}

export type ThresholdResult = {
  passed: boolean
  failures: ThresholdFailure[]
}

export function checkThresholds(config: NormalizedCovraConfig, coverageMap: any): ThresholdResult {
  const failures: ThresholdFailure[] = []
  const thresholds = normalizeHundred(config.thresholds)

  checkSummary('global', coverageMap.getCoverageSummary().toJSON(), thresholds, failures)

  if (thresholds.perFile) {
    for (const file of coverageMap.files()) {
      const summary = coverageMap.fileCoverageFor(file).toSummary().toJSON()
      checkSummary(relativeToRoot(config.rootDir, file), summary, thresholds, failures)
    }
  }

  for (const [glob, block] of Object.entries(thresholds)) {
    if (reservedKeys.has(glob) || typeof block !== 'object' || block === null || Array.isArray(block)) {
      continue
    }

    const globThreshold = normalizeHundred(block as ThresholdBlock)
    const matchedFiles = coverageMap
      .files()
      .filter((file: string) => micromatch.isMatch(relativeToRoot(config.rootDir, file), glob))

    if (matchedFiles.length === 0) continue

    for (const file of matchedFiles) {
      const summary = coverageMap.fileCoverageFor(file).toSummary().toJSON()
      checkSummary(relativeToRoot(config.rootDir, file), summary, globThreshold, failures, glob)
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  }
}

function checkSummary(
  scope: string,
  summary: Record<CoverageMetric, { pct: number; total: number; covered: number }>,
  thresholds: ThresholdBlock,
  failures: ThresholdFailure[],
  label?: string,
): void {
  for (const metric of metrics) {
    const expected = thresholds[metric]
    if (typeof expected !== 'number') continue

    const actualSummary = summary[metric]
    if (!actualSummary) continue

    const uncovered = actualSummary.total - actualSummary.covered
    if (expected >= 0) {
      if (actualSummary.pct < expected) {
        failures.push({
          scope: label ? `${scope} (${label})` : scope,
          metric,
          expected,
          actual: actualSummary.pct,
          uncovered,
          mode: 'percent',
        })
      }
    } else if (uncovered > Math.abs(expected)) {
      failures.push({
        scope: label ? `${scope} (${label})` : scope,
        metric,
        expected,
        actual: actualSummary.pct,
        uncovered,
        mode: 'uncovered',
      })
    }
  }
}

function normalizeHundred(thresholds: ThresholdBlock): ThresholdBlock {
  if (thresholds[100] !== true) return thresholds
  return {
    ...thresholds,
    lines: thresholds.lines ?? 100,
    statements: thresholds.statements ?? 100,
    functions: thresholds.functions ?? 100,
    branches: thresholds.branches ?? 100,
  }
}
