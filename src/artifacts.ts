import fs from 'node:fs/promises'
import path from 'node:path'
import type {
  BrowserCoverageArtifact,
  NormalizedCovraConfig,
  PlaywrightJSCoverageEntry,
} from './types.js'
import { hashText, safeFilePart } from './path-utils.js'

export async function writeBrowserCoverageArtifact(options: {
  rawDir: string
  entries: PlaywrightJSCoverageEntry[]
  test?: BrowserCoverageArtifact['test']
}): Promise<string> {
  const dir = path.join(options.rawDir, 'browser')
  await fs.mkdir(dir, { recursive: true })

  const testFile = options.test?.file ? safeFilePart(options.test.file) : 'unknown'
  const title = options.test?.title ? safeFilePart(options.test.title) : 'test'
  const suffix = hashText(`${Date.now()}-${Math.random()}-${testFile}-${title}`)
  const file = path.join(dir, `${testFile}-${title}-${suffix}.json`)

  const artifact: BrowserCoverageArtifact = {
    kind: 'browser-v8',
    version: 1,
    createdAt: new Date().toISOString(),
    test: options.test,
    entries: options.entries,
  }

  await fs.writeFile(file, JSON.stringify(artifact, null, 2))
  return file
}

export async function readJsonFile<T>(file: string): Promise<T> {
  return JSON.parse(await fs.readFile(file, 'utf8')) as T
}

export function browserRawDir(config: NormalizedCovraConfig): string {
  return path.join(config.rawDir, 'browser')
}

export function serverRawDir(config: NormalizedCovraConfig): string {
  return config.collect.server.coverageDir
}
