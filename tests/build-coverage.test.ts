import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeConfig } from '../src/config.js'
import { buildCoverageMap } from '../src/convert.js'

describe('buildCoverageMap', () => {
  it('adds included but unexecuted source files as 0 percent coverage', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covra-'))
    await fs.mkdir(path.join(root, 'src'), { recursive: true })
    await fs.writeFile(path.join(root, 'src/example.ts'), 'export const value = 1\n')

    const config = normalizeConfig(
      {
        strict: false,
        collect: {
          browser: false,
          server: false,
        },
        include: ['src/**/*.ts'],
        outputDir: 'coverage/covra',
        rawDir: '.covra/raw',
      },
      root,
    )

    const result = await buildCoverageMap(config)
    const summary = result.coverageMap.getCoverageSummary().toJSON()

    expect(result.coverageMap.files()).toContain(path.join(root, 'src/example.ts'))
    expect(summary.lines.pct).toBe(0)
  })
})
