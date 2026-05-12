import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import istanbulCoverage from 'istanbul-lib-coverage'
import { normalizeConfig } from '../src/config.js'
import { buildRouteCoverageRows } from '../src/route-report.js'

const { createCoverageMap } = istanbulCoverage

describe('buildRouteCoverageRows', () => {
  it('matches observed public routes to leading dynamic App Router routes', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covra-routes-'))
    const config = normalizeConfig({ include: ['src/app/**/*.{ts,tsx}'] }, root)
    const file = path.join(config.rootDir, 'src/app/[locale]/(marketing)/counter/page.tsx')
    const missingFile = path.join(config.rootDir, 'src/app/[locale]/(marketing)/pricing/page.tsx')
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, 'export default function Page() { return null }\n')
    await fs.mkdir(path.dirname(missingFile), { recursive: true })
    await fs.writeFile(missingFile, 'export default function Page() { return null }\n')

    const coverageMap = createCoverageMap({
      [file]: {
        path: file,
        statementMap: {
          0: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
        },
        fnMap: {},
        branchMap: {},
        s: { 0: 1 },
        f: {},
        b: {},
      },
      [missingFile]: {
        path: missingFile,
        statementMap: {
          0: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
        },
        fnMap: {},
        branchMap: {},
        s: { 0: 1 },
        f: {},
        b: {},
      },
    })

    try {
      const rows = buildRouteCoverageRows(config, coverageMap, {
        files: [],
        routes: [
          {
            route: '/counter',
            tests: ['counter increments'],
            uxStates: ['counter.increment.success'],
          },
        ],
      })

      expect(rows).toHaveLength(2)
      expect(rows.find((row) => row.route === '/[locale]/counter')).toMatchObject({
        route: '/[locale]/counter',
        observed: true,
        flow: { pct: 100, covered: 1, total: 1 },
        tests: ['counter increments'],
        uxStates: ['counter.increment.success'],
      })
      expect(rows.find((row) => row.route === '/[locale]/pricing')).toMatchObject({
        route: '/[locale]/pricing',
        observed: false,
        flow: { pct: 0, covered: 0, total: 1 },
      })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})
