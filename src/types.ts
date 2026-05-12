export type CoverageMetric = 'lines' | 'statements' | 'functions' | 'branches'

export type BuiltInReport =
  | 'text'
  | 'text-summary'
  | 'html'
  | 'lcov'
  | 'json'
  | 'json-summary'

export type ReportSpec = BuiltInReport | [BuiltInReport, Record<string, unknown>]

export type ThresholdValue = number

export type ThresholdBlock = {
  lines?: ThresholdValue
  statements?: ThresholdValue
  functions?: ThresholdValue
  branches?: ThresholdValue
  perFile?: boolean
  100?: boolean
  [glob: string]: unknown
}

export type CollectBooleanOrOptions<T> = boolean | T

export type BrowserCollectOptions = {
  enabled?: boolean
  project?: string
  resetOnNavigation?: boolean
  reportAnonymousScripts?: boolean
}

export type ServerCollectOptions = {
  enabled?: boolean
  coverageDir?: string
  teardownWaitMs?: number
}

export type CovraConfig = {
  rootDir?: string
  framework?: 'next' | 'generic'
  strict?: boolean
  include?: string[]
  exclude?: string[]
  all?: boolean
  rawDir?: string
  outputDir?: string
  reports?: ReportSpec[]
  thresholds?: ThresholdBlock
  collect?: {
    browser?: CollectBooleanOrOptions<BrowserCollectOptions>
    server?: CollectBooleanOrOptions<ServerCollectOptions>
  }
  merge?: {
    coverageFiles?: string[]
    vitest?: string[]
  }
  sourceMaps?: {
    search?: string[]
  }
  debug?: {
    keepRaw?: boolean
  }
}

export type NormalizedBrowserCollectOptions = Required<BrowserCollectOptions>
export type NormalizedServerCollectOptions = Required<ServerCollectOptions>

export type NormalizedCovraConfig = Required<
  Pick<
    CovraConfig,
    | 'rootDir'
    | 'framework'
    | 'strict'
    | 'include'
    | 'exclude'
    | 'all'
    | 'rawDir'
    | 'outputDir'
    | 'reports'
    | 'thresholds'
  >
> & {
  collect: {
    browser: NormalizedBrowserCollectOptions
    server: NormalizedServerCollectOptions
  }
  merge: {
    coverageFiles: string[]
  }
  sourceMaps: {
    search: string[]
  }
  debug: {
    keepRaw: boolean
  }
}

export type DiagnosticLevel = 'info' | 'warn' | 'error'

export type Diagnostic = {
  level: DiagnosticLevel
  code: string
  message: string
  detail?: string
}

export type CovraRunResult = {
  diagnostics: Diagnostic[]
  coverageFile?: string
  passedThresholds?: boolean
}

export type PlaywrightJSCoverageEntry = {
  url: string
  scriptId?: string
  source?: string
  functions: Array<{
    functionName: string
    isBlockCoverage: boolean
    ranges: Array<{
      startOffset: number
      endOffset: number
      count: number
    }>
  }>
}

export type BrowserCoverageArtifact = {
  kind: 'browser-v8'
  version: 1
  createdAt: string
  test?: {
    title?: string
    file?: string
    project?: string
    workerIndex?: number
    retry?: number
    status?: string
  }
  entries: PlaywrightJSCoverageEntry[]
}

export type NodeV8CoverageFile = {
  result?: Array<{
    scriptId?: string
    url: string
    functions: PlaywrightJSCoverageEntry['functions']
  }>
  'source-map-cache'?: Record<string, unknown>
}

export type CoverageRuntime = 'browser' | 'server' | 'merged' | 'empty'

export type FileRuntimeInfo = {
  file: string
  runtimes: Set<CoverageRuntime>
  generatedUrls: Set<string>
  sourceMapStatus: 'resolved' | 'missing' | 'unknown'
}
