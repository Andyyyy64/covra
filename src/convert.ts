import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import fg from 'fast-glob'
import micromatch from 'micromatch'
import v8ToIstanbul from 'v8-to-istanbul'
import istanbulCoverage from 'istanbul-lib-coverage'
import type {
  BrowserCoverageArtifact,
  Diagnostic,
  FileRuntimeInfo,
  NodeV8CoverageFile,
  NormalizedCovraConfig,
  PlaywrightJSCoverageEntry,
  CoverageRuntime,
  RouteRuntimeInfo,
} from './types.js'
import { browserRawDir, readJsonFile, serverRawDir } from './artifacts.js'
import {
  absoluteFromRoot,
  hashText,
  isLikelyUserSource,
  normalizeCoverageFilePath,
  relativeToRoot,
  resolveGeneratedFile,
  slash,
} from './path-utils.js'
import { routeInfoForFile } from './routes.js'

type CoverageMapLike = ReturnType<typeof createCoverageMap>
const { createCoverageMap } = istanbulCoverage

export type BuildCoverageResult = {
  coverageMap: CoverageMapLike
  diagnostics: Diagnostic[]
  fileInfo: Map<string, FileRuntimeInfo>
  routeInfo: Map<string, RouteRuntimeInfo>
}

type V8EntryInput = {
  runtime: CoverageRuntime
  url: string
  source?: string
  functions: PlaywrightJSCoverageEntry['functions']
  test?: BrowserCoverageArtifact['test']
}

export async function buildCoverageMap(config: NormalizedCovraConfig): Promise<BuildCoverageResult> {
  const diagnostics: Diagnostic[] = []
  const coverageMap = createCoverageMap({})
  const fileInfo = new Map<string, FileRuntimeInfo>()
  const routeInfo = new Map<string, RouteRuntimeInfo>()

  await addBrowserCoverage(config, coverageMap, diagnostics, fileInfo, routeInfo)
  await addServerCoverage(config, coverageMap, diagnostics, fileInfo)
  await addExternalCoverage(config, coverageMap, diagnostics)

  normalizeMapFiles(config, coverageMap, diagnostics, fileInfo)

  if (config.all) {
    await addEmptyCoverageForUncoveredFiles(config, coverageMap, diagnostics, fileInfo)
  }

  return {
    coverageMap,
    diagnostics,
    fileInfo,
    routeInfo,
  }
}

async function addBrowserCoverage(
  config: NormalizedCovraConfig,
  map: CoverageMapLike,
  diagnostics: Diagnostic[],
  fileInfo: Map<string, FileRuntimeInfo>,
  routeInfo: Map<string, RouteRuntimeInfo>,
): Promise<void> {
  if (!config.collect.browser.enabled) return

  const files = await fg('**/*.json', {
    cwd: browserRawDir(config),
    absolute: true,
    onlyFiles: true,
    suppressErrors: true,
  })

  if (files.length === 0) {
    diagnostics.push({
      level: config.strict ? 'error' : 'warn',
      code: 'browser.raw.missing',
      message: 'No browser coverage artifacts were found.',
      detail: `Expected JSON artifacts under ${browserRawDir(config)}.`,
    })
    return
  }

  let mappedEntries = 0
  for (const file of files) {
    const artifact = await safeReadJson<BrowserCoverageArtifact>(file, diagnostics)
    if (!artifact || artifact.kind !== 'browser-v8') continue
    markRouteRuntime(routeInfo, artifact.test)
    for (const navigation of artifact.navigations ?? []) {
      markRouteFromUrl(routeInfo, navigation, artifact.test)
    }
    for (const request of artifact.requests ?? []) {
      markRouteFromUrl(routeInfo, request, artifact.test, { apiOnly: true })
    }

    for (const entry of artifact.entries) {
      mappedEntries += await convertEntry(config, map, diagnostics, fileInfo, {
        runtime: 'browser',
        url: entry.url,
        source: entry.source,
        functions: entry.functions,
        test: artifact.test,
      })
    }
  }

  if (mappedEntries === 0) {
    diagnostics.push({
      level: config.strict ? 'error' : 'warn',
      code: 'browser.remap.empty',
      message: 'Browser coverage artifacts were found, but none mapped back to included source files.',
      detail: 'Check that the Playwright project is chromium, source maps are emitted, and include/exclude globs match your app source.',
    })
  }
}

async function addServerCoverage(
  config: NormalizedCovraConfig,
  map: CoverageMapLike,
  diagnostics: Diagnostic[],
  fileInfo: Map<string, FileRuntimeInfo>,
): Promise<void> {
  if (!config.collect.server.enabled) return

  const files = await fg('**/*.json', {
    cwd: serverRawDir(config),
    absolute: true,
    onlyFiles: true,
    suppressErrors: true,
  })

  if (files.length === 0) {
    diagnostics.push({
      level: config.strict ? 'error' : 'warn',
      code: 'server.raw.missing',
      message: 'No server coverage artifacts were found.',
      detail: `Expected NODE_V8_COVERAGE JSON files under ${serverRawDir(config)}.`,
    })
    return
  }

  let mappedEntries = 0
  for (const file of files) {
    const artifact = await safeReadJson<NodeV8CoverageFile>(file, diagnostics)
    if (!artifact?.result) continue

    for (const entry of artifact.result) {
      mappedEntries += await convertEntry(config, map, diagnostics, fileInfo, {
        runtime: 'server',
        url: entry.url,
        functions: entry.functions,
      })
    }
  }

  if (mappedEntries === 0) {
    diagnostics.push({
      level: config.strict ? 'error' : 'warn',
      code: 'server.remap.empty',
      message: 'Server coverage artifacts were found, but none mapped back to included source files.',
      detail: 'Check NODE_V8_COVERAGE, withCovra(), production source maps, and include/exclude globs.',
    })
  }
}

async function addExternalCoverage(
  config: NormalizedCovraConfig,
  map: CoverageMapLike,
  diagnostics: Diagnostic[],
): Promise<void> {
  for (const file of config.merge.coverageFiles) {
    if (!existsSync(file)) {
      diagnostics.push({
        level: 'warn',
        code: 'merge.file.missing',
        message: 'Configured coverage file was not found.',
        detail: file,
      })
      continue
    }

    const data = await safeReadJson<Record<string, unknown>>(file, diagnostics)
    if (!data) continue

    try {
      map.merge(data)
    } catch (error) {
      diagnostics.push({
        level: 'error',
        code: 'merge.file.invalid',
        message: 'Failed to merge coverage file.',
        detail: `${file}: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }
}

async function convertEntry(
  config: NormalizedCovraConfig,
  map: CoverageMapLike,
  diagnostics: Diagnostic[],
  fileInfo: Map<string, FileRuntimeInfo>,
  entry: V8EntryInput,
): Promise<number> {
  if (!entry.url || entry.url.startsWith('node:') || entry.url.includes('/node_modules/')) return 0
  if (!entry.functions?.length) return 0

  const generatedFile = await materializeGeneratedFile(config, entry, diagnostics)
  if (!generatedFile) return 0

  try {
    const converter = v8ToIstanbul(generatedFile, 0, entry.source ? { source: entry.source } : undefined)
    await converter.load()
    converter.applyCoverage(entry.functions)
    const data = converter.toIstanbul()
    const normalized = normalizeIstanbulData(config, data, diagnostics, fileInfo, entry.runtime, entry.url, entry.test)
    map.merge(normalized)
    return Object.keys(normalized).length
  } catch (error) {
    diagnostics.push({
      level: 'warn',
      code: 'v8.convert.failed',
      message: 'Failed to convert a V8 coverage entry.',
      detail: `${entry.url}: ${error instanceof Error ? error.message : String(error)}`,
    })
    return 0
  }
}

async function materializeGeneratedFile(
  config: NormalizedCovraConfig,
  entry: V8EntryInput,
  diagnostics: Diagnostic[],
): Promise<string | undefined> {
  const generatedFile = resolveGeneratedFile(config.rootDir, entry.url)

  if (generatedFile && existsSync(generatedFile)) {
    return generatedFile
  }

  if (entry.source) {
    const dir = path.join(config.rawDir, '..', 'tmp/generated')
    await fs.mkdir(dir, { recursive: true })
    const file = path.join(dir, `${entry.runtime}-${hashText(entry.url)}.js`)
    await fs.writeFile(file, entry.source)
    return file
  }

  diagnostics.push({
    level: 'info',
    code: 'generated.file.missing',
    message: 'Could not locate generated JavaScript for a coverage entry.',
    detail: entry.url,
  })

  return undefined
}

function normalizeIstanbulData(
  config: NormalizedCovraConfig,
  data: Record<string, unknown>,
  diagnostics: Diagnostic[],
  fileInfo: Map<string, FileRuntimeInfo>,
  runtime: CoverageRuntime,
  generatedUrl: string,
  test?: BrowserCoverageArtifact['test'],
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {}

  for (const [file, value] of Object.entries(data)) {
    const normalizedFile = normalizeCoverageFilePath(config.rootDir, file)
    if (!normalizedFile || !existsSync(normalizedFile) || !isLikelyUserSource(config.rootDir, normalizedFile)) continue
    if (!matchesCoverageTarget(config, normalizedFile)) continue

    const mutable = toMutableCoverage(value)
    mutable.path = normalizedFile
    normalized[normalizedFile] = mutable
    markFileRuntime(config, fileInfo, normalizedFile, runtime, generatedUrl, 'resolved', test)
  }

  if (Object.keys(data).length > 0 && Object.keys(normalized).length === 0) {
    diagnostics.push({
      level: 'info',
      code: 'source.remap.empty',
      message: 'A converted coverage entry did not map back to user source files.',
      detail: generatedUrl,
    })
  }

  return normalized
}

function normalizeMapFiles(
  config: NormalizedCovraConfig,
  map: CoverageMapLike,
  diagnostics: Diagnostic[],
  fileInfo: Map<string, FileRuntimeInfo>,
): void {
  const data = map.toJSON()
  const normalizedMap = createCoverageMap({})
  let changed = false

  for (const [file, value] of Object.entries(data)) {
    const normalizedFile = normalizeCoverageFilePath(config.rootDir, file)
    if (
      !normalizedFile ||
      !existsSync(normalizedFile) ||
      !isLikelyUserSource(config.rootDir, normalizedFile) ||
      !matchesCoverageTarget(config, normalizedFile)
    ) {
      changed = true
      continue
    }

    const mutable = toMutableCoverage(value)
    mutable.path = normalizedFile
    normalizedMap.merge({ [normalizedFile]: mutable })

    if (normalizedFile !== file) changed = true
    markFileRuntime(config, fileInfo, normalizedFile, 'merged', file, 'unknown')
  }

  if (!changed) return

  try {
    map.data = normalizedMap.data
  } catch {
    diagnostics.push({
      level: 'warn',
      code: 'coverage.normalize.failed',
      message: 'Coverage file path normalization could not replace the original map.',
    })
  }
}

async function addEmptyCoverageForUncoveredFiles(
  config: NormalizedCovraConfig,
  map: CoverageMapLike,
  diagnostics: Diagnostic[],
  fileInfo: Map<string, FileRuntimeInfo>,
): Promise<void> {
  const files = await fg(config.include, {
    cwd: config.rootDir,
    ignore: config.exclude,
    absolute: true,
    onlyFiles: true,
  })

  for (const file of files) {
    const absolute = absoluteFromRoot(config.rootDir, file)
    if (map.files().includes(absolute)) continue

    try {
      const source = await fs.readFile(absolute, 'utf8')
      const converter = v8ToIstanbul(absolute, 0, { source })
      await converter.load()
      converter.applyCoverage([
        {
          functionName: '(empty-report)',
          isBlockCoverage: true,
          ranges: [{ startOffset: 0, endOffset: source.length, count: 0 }],
        },
      ])
      map.merge(converter.toIstanbul())
      markFileRuntime(config, fileInfo, absolute, 'empty', absolute, 'unknown')
    } catch (error) {
      diagnostics.push({
        level: 'warn',
        code: 'empty.coverage.failed',
        message: 'Failed to add an uncovered file to the coverage map.',
        detail: `${relativeToRoot(config.rootDir, absolute)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      })
    }
  }
}

function markFileRuntime(
  config: NormalizedCovraConfig,
  fileInfo: Map<string, FileRuntimeInfo>,
  file: string,
  runtime: CoverageRuntime,
  generatedUrl: string,
  sourceMapStatus: FileRuntimeInfo['sourceMapStatus'],
  test?: BrowserCoverageArtifact['test'],
): void {
  const existing =
    fileInfo.get(file) ??
    ({
      file,
      runtimes: new Set(),
      generatedUrls: new Set(),
      sourceMapStatus,
      tests: new Set(),
      uxStates: new Set(),
    } satisfies FileRuntimeInfo)

  existing.runtimes.add(runtime)
  existing.generatedUrls.add(generatedUrl)
  if (existing.sourceMapStatus === 'unknown') existing.sourceMapStatus = sourceMapStatus

  if (test?.title) {
    existing.tests.add(test.title)
  }

  for (const state of uxStatesForFile(config.rootDir, file, test)) {
    existing.uxStates.add(state)
  }

  fileInfo.set(file, existing)
}

function uxStatesForFile(rootDir: string, file: string, test?: BrowserCoverageArtifact['test']): string[] {
  const route = routeInfoForFile(rootDir, file)?.route
  const states: string[] = []

  for (const annotation of test?.annotations ?? []) {
    if (annotation.type !== 'covra:ux' || !annotation.description) continue

    try {
      const mark = JSON.parse(annotation.description) as { route?: string; state?: string; label?: string }
      if (!mark.state) continue
      if (mark.route && route && mark.route !== route) continue
      if (mark.route && !route) continue
      states.push(mark.label ? `${mark.state}: ${mark.label}` : mark.state)
    } catch {
      // Ignore malformed user annotations. They should not break coverage generation.
    }
  }

  return states
}

function markRouteRuntime(routeInfo: Map<string, RouteRuntimeInfo>, test?: BrowserCoverageArtifact['test']): void {
  const title = test?.title

  for (const annotation of test?.annotations ?? []) {
    if (annotation.type !== 'covra:ux' || !annotation.description) continue

    try {
      const mark = JSON.parse(annotation.description) as { route?: string; state?: string; label?: string }
      if (!mark.route || !mark.state) continue
      const existing =
        routeInfo.get(mark.route) ??
        ({
          route: mark.route,
          runtimes: new Set(),
          tests: new Set(),
          uxStates: new Set(),
        } satisfies RouteRuntimeInfo)

      if (title) existing.tests.add(title)
      existing.runtimes.add('browser')
      existing.uxStates.add(mark.label ? `${mark.state}: ${mark.label}` : mark.state)
      routeInfo.set(mark.route, existing)
    } catch {
      // Ignore malformed user annotations. They should not break coverage generation.
    }
  }
}

function markRouteFromUrl(
  routeInfo: Map<string, RouteRuntimeInfo>,
  url: string,
  test?: BrowserCoverageArtifact['test'],
  options: { apiOnly?: boolean } = {},
): void {
  const title = test?.title
  const route = routeFromUrl(url)
  if (!route) return
  if (options.apiOnly && !route.startsWith('/api/')) return

  const existing =
    routeInfo.get(route) ??
    ({
      route,
      runtimes: new Set(),
      tests: new Set(),
      uxStates: new Set(),
    } satisfies RouteRuntimeInfo)

  existing.runtimes.add('browser')
  if (title) existing.tests.add(title)
  routeInfo.set(route, existing)
}

function routeFromUrl(value: string): string | undefined {
  try {
    const url = new URL(value)
    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    if (pathname.startsWith('/_next/')) return undefined
    if (pathname.includes('.')) return undefined
    return pathname
  } catch {
    return undefined
  }
}

function matchesCoverageTarget(config: NormalizedCovraConfig, file: string): boolean {
  const relative = relativeToRoot(config.rootDir, file)
  return micromatch.isMatch(relative, config.include) && !micromatch.isMatch(relative, config.exclude)
}

async function safeReadJson<T>(file: string, diagnostics: Diagnostic[]): Promise<T | undefined> {
  try {
    return await readJsonFile<T>(file)
  } catch (error) {
    diagnostics.push({
      level: 'warn',
      code: 'json.read.failed',
      message: 'Failed to read JSON artifact.',
      detail: `${slash(file)}: ${error instanceof Error ? error.message : String(error)}`,
    })
    return undefined
  }
}

function toMutableCoverage(value: unknown): { path?: string } {
  const serializable = value && typeof value === 'object' && 'toJSON' in value
    ? (value as { toJSON(): unknown }).toJSON()
    : value
  return JSON.parse(JSON.stringify(serializable)) as { path?: string }
}
