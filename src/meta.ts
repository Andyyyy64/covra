import fs from 'node:fs/promises'
import path from 'node:path'
import type { Diagnostic, FileRuntimeInfo, NormalizedCovraConfig, RouteRuntimeInfo } from './types.js'
import { routeInfoForFile } from './routes.js'

export type CovraMetaFile = {
  version: 1
  createdAt: string
  confidence: number
  diagnostics: Diagnostic[]
  files: Array<{
    file: string
    runtimes: string[]
    generatedUrls: string[]
    sourceMapStatus: string
    tests?: string[]
    uxStates?: string[]
    route?: string
    routeKind?: string
  }>
  routes?: Array<{
    route: string
    tests: string[]
    uxStates: string[]
  }>
}

export async function writeMetaFile(options: {
  config: NormalizedCovraConfig
  diagnostics: Diagnostic[]
  fileInfo: Map<string, FileRuntimeInfo>
  routeInfo?: Map<string, RouteRuntimeInfo>
}): Promise<string> {
  const meta: CovraMetaFile = {
    version: 1,
    createdAt: new Date().toISOString(),
    confidence: calculateConfidence(options.diagnostics),
    diagnostics: options.diagnostics,
    files: [...options.fileInfo.values()].map((file) => {
      const routeInfo = routeInfoForFile(options.config.rootDir, file.file)
      return {
        file: file.file,
        runtimes: [...file.runtimes],
        generatedUrls: [...file.generatedUrls],
        sourceMapStatus: file.sourceMapStatus,
        tests: [...file.tests],
        uxStates: [...file.uxStates],
        route: routeInfo?.route,
        routeKind: routeInfo?.kind,
      }
    }),
    routes: [...(options.routeInfo?.values() ?? [])].map((route) => ({
      route: route.route,
      tests: [...route.tests],
      uxStates: [...route.uxStates],
    })),
  }

  await fs.mkdir(options.config.outputDir, { recursive: true })
  const file = path.join(options.config.outputDir, 'covra-meta.json')
  await fs.writeFile(file, JSON.stringify(meta, null, 2))
  return file
}

export async function readMetaFile(config: NormalizedCovraConfig): Promise<CovraMetaFile | undefined> {
  try {
    return JSON.parse(await fs.readFile(path.join(config.outputDir, 'covra-meta.json'), 'utf8')) as CovraMetaFile
  } catch {
    return undefined
  }
}

export function calculateConfidence(diagnostics: Diagnostic[]): number {
  const score = diagnostics.reduce((current, diagnostic) => {
    if (diagnostic.level === 'error') return current - 15
    if (diagnostic.level === 'warn') return current - 4
    return current
  }, 100)

  return Math.max(0, Math.min(100, score))
}
