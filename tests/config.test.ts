import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { normalizeConfig } from '../src/config.js'

describe('normalizeConfig', () => {
  it('keeps Vitest as an optional coverage file input instead of a core dependency', () => {
    const config = normalizeConfig(
      {
        merge: {
          vitest: ['coverage/unit/coverage-final.json'],
          coverageFiles: ['coverage/other/coverage-final.json'],
        },
      },
      '/repo',
    )

    expect(config.merge.coverageFiles).toEqual([
      '/repo/coverage/other/coverage-final.json',
      '/repo/coverage/unit/coverage-final.json',
    ])
  })

  it('canonicalizes rootDir so symlinked workspaces do not split coverage paths', async () => {
    const realRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'covra-real-root-'))
    const linkRoot = path.join(os.tmpdir(), `covra-link-root-${Date.now()}`)
    await fsp.symlink(realRoot, linkRoot, 'dir')

    try {
      const config = normalizeConfig({}, linkRoot)
      expect(config.rootDir).toBe(fs.realpathSync(realRoot))
    } finally {
      await fsp.rm(linkRoot, { force: true, recursive: true })
      await fsp.rm(realRoot, { force: true, recursive: true })
    }
  })
})
