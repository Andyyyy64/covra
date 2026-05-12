import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { doctorCommand } from '../src/commands.js'

describe('doctorCommand', () => {
  it('treats runtime artifacts as optional before a coverage run', async () => {
    const root = await createFixtureRoot()
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    try {
      await expect(doctorCommand({ cwd: root })).resolves.toBe(0)
      await expect(doctorCommand({ cwd: root, postRun: true })).resolves.toBe(1)
    } finally {
      log.mockRestore()
    }
  })
})

async function createFixtureRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covra-doctor-'))
  await fs.mkdir(path.join(root, 'src'), { recursive: true })
  await fs.writeFile(path.join(root, 'src/example.ts'), 'export const value = 1\n')
  await fs.writeFile(path.join(root, 'next.config.ts'), 'export default {}\n')
  await fs.writeFile(path.join(root, 'playwright.config.ts'), 'export default {}\n')
  return root
}
