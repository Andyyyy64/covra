import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeConfig } from '../src/config.js'
import { buildCoverageMap } from '../src/convert.js'

describe('missing coverage artifacts', () => {
  it('is an error in strict mode so CI cannot silently pass without collection', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covra-missing-'))
    await fs.mkdir(path.join(root, 'src'), { recursive: true })
    await fs.writeFile(path.join(root, 'src/example.ts'), 'export const value = 1\n')

    const config = normalizeConfig(
      {
        include: ['src/**/*.ts'],
        rawDir: '.covra/raw',
      },
      root,
    )

    const result = await buildCoverageMap(config)

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: 'error', code: 'browser.raw.missing' }),
        expect.objectContaining({ level: 'error', code: 'server.raw.missing' }),
      ]),
    )
  })
})
