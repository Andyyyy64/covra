import { describe, expect, it } from 'vitest'
import { normalizeCoverageFilePath } from '../src/path-utils.js'

describe('normalizeCoverageFilePath', () => {
  it('maps webpack server-source-map absolute app/src paths back under the project root', () => {
    expect(normalizeCoverageFilePath('/repo/app', '/src/serverGreeting.ts')).toBe(
      '/repo/app/src/serverGreeting.ts',
    )
    expect(normalizeCoverageFilePath('/repo/app', '/app/page.tsx')).toBe('/repo/app/app/page.tsx')
  })
})
