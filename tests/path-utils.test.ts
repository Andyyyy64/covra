import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { normalizeCoverageFilePath } from '../src/path-utils.js'

describe('normalizeCoverageFilePath', () => {
  it('maps webpack server-source-map absolute app/src paths back under the project root', () => {
    expect(normalizeCoverageFilePath('/repo/app', '/src/serverGreeting.ts')).toBe(
      '/repo/app/src/serverGreeting.ts',
    )
    expect(normalizeCoverageFilePath('/repo/app', '/app/page.tsx')).toBe('/repo/app/app/page.tsx')
  })

  it('maps Next.js nested server source-map paths back to real src/app files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covra-paths-'))
    const sourceFile = path.join(root, 'src/app/[locale]/(marketing)/counter/page.tsx')
    await fs.mkdir(path.dirname(sourceFile), { recursive: true })
    await fs.writeFile(sourceFile, 'export default function Page() { return null }\n')

    const generatedSourcePath = path.join(
      root,
      '.next/server/app/[locale]/(marketing)/counter/next-js-boilerplate/src/app/[locale]/(marketing)/counter/page.tsx',
    )

    try {
      expect(normalizeCoverageFilePath(root, generatedSourcePath)).toBe(sourceFile)
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})
