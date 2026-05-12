import { describe, expect, it } from 'vitest'
import istanbulCoverage from 'istanbul-lib-coverage'
import { normalizeConfig } from '../src/config.js'
import { checkThresholds } from '../src/thresholds.js'

const { createCoverageMap } = istanbulCoverage

describe('checkThresholds', () => {
  it('supports Vitest-like percent and negative uncovered thresholds', () => {
    const config = normalizeConfig(
      {
        thresholds: {
          lines: 90,
          statements: -1,
        },
      },
      '/repo',
    )
    const map = createCoverageMap({
      '/repo/src/a.ts': {
        path: '/repo/src/a.ts',
        statementMap: {
          0: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
          1: { start: { line: 2, column: 0 }, end: { line: 2, column: 1 } },
        },
        fnMap: {},
        branchMap: {},
        s: { 0: 1, 1: 0 },
        f: {},
        b: {},
      },
    })

    const result = checkThresholds(config, map)
    expect(result.passed).toBe(false)
    expect(result.failures.map((failure) => failure.metric)).toContain('lines')
    expect(result.failures.some((failure) => failure.metric === 'statements')).toBe(false)
  })
})
