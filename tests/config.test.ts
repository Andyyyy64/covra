import { describe, expect, it } from 'vitest'
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
})
