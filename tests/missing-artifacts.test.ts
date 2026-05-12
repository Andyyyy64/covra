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

  it('errors when browser artifacts exist but no included source file can be remapped', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covra-empty-browser-'))
    await fs.mkdir(path.join(root, 'src'), { recursive: true })
    await fs.mkdir(path.join(root, '.covra/raw/browser'), { recursive: true })
    await fs.writeFile(path.join(root, 'src/example.ts'), 'export const value = 1\n')
    await fs.writeFile(
      path.join(root, '.covra/raw/browser/artifact.json'),
      JSON.stringify({
        kind: 'browser-v8',
        version: 1,
        createdAt: new Date().toISOString(),
        entries: [
          {
            url: 'http://127.0.0.1:3000/_next/static/chunks/framework.js',
            source: 'console.log("framework")',
            functions: [
              {
                functionName: '(root)',
                isBlockCoverage: true,
                ranges: [{ startOffset: 0, endOffset: 24, count: 1 }],
              },
            ],
          },
        ],
      }),
    )

    const config = normalizeConfig(
      {
        include: ['src/**/*.ts'],
        rawDir: '.covra/raw',
        collect: {
          server: false,
        },
      },
      root,
    )

    const result = await buildCoverageMap(config)

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: 'error', code: 'browser.remap.empty' }),
      ]),
    )
  })
})
