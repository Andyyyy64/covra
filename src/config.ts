import { existsSync } from 'node:fs'
import path from 'node:path'
import { createJiti } from 'jiti'
import type { CovraConfig, NormalizedCovraConfig } from './types.js'

const defaultConfigFiles = [
  'covra.config.ts',
  'covra.config.mts',
  'covra.config.js',
  'covra.config.mjs',
]

export function defineCovraConfig(config: CovraConfig): CovraConfig {
  return config
}

export async function loadCovraConfig(options: {
  cwd?: string
  config?: string
} = {}): Promise<NormalizedCovraConfig> {
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const configPath = findConfigPath(cwd, options.config)
  let loaded: CovraConfig = {}

  if (configPath) {
    const jiti = createJiti(import.meta.url)
    const mod = await jiti.import(configPath, { default: true })
    loaded = (mod ?? {}) as CovraConfig
  }

  return normalizeConfig(loaded, configPath ? path.dirname(configPath) : cwd)
}

export function findConfigPath(cwd: string, explicit?: string): string | undefined {
  if (explicit) {
    const resolved = path.resolve(cwd, explicit)
    return existsSync(resolved) ? resolved : undefined
  }

  for (const file of defaultConfigFiles) {
    const fullPath = path.join(cwd, file)
    if (existsSync(fullPath)) return fullPath
  }

  return undefined
}

export function normalizeConfig(config: CovraConfig, cwd = process.cwd()): NormalizedCovraConfig {
  const rootDir = path.resolve(cwd, config.rootDir ?? '.')
  const rawDir = path.resolve(rootDir, config.rawDir ?? '.covra/raw')
  const outputDir = path.resolve(rootDir, config.outputDir ?? 'coverage/covra')

  const browser = normalizeBooleanOrOptions(config.collect?.browser, {
    enabled: true,
    project: 'chromium',
    resetOnNavigation: false,
    reportAnonymousScripts: false,
  })

  const server = normalizeBooleanOrOptions(config.collect?.server, {
    enabled: true,
    coverageDir: path.join(rawDir, 'server'),
    includeStartupCoverage: false,
    teardownWaitMs: 3000,
  })

  const mergeFiles = [
    ...(config.merge?.coverageFiles ?? []),
    ...(config.merge?.vitest ?? []),
  ].map((file) => path.resolve(rootDir, file))

  return {
    rootDir,
    framework: config.framework ?? 'next',
    strict: config.strict ?? true,
    include: config.include ?? [
      'app/**/*.{js,jsx,ts,tsx}',
      'pages/**/*.{js,jsx,ts,tsx}',
      'src/**/*.{js,jsx,ts,tsx}',
    ],
    exclude: config.exclude ?? [
      '**/*.test.*',
      '**/*.spec.*',
      '**/*.stories.*',
      '**/__tests__/**',
      '**/node_modules/**',
      '**/.next/**',
    ],
    all: config.all ?? true,
    rawDir,
    outputDir,
    reports: config.reports ?? ['text-summary', 'html', 'lcov', 'json', 'json-summary'],
    thresholds: config.thresholds ?? {},
    collect: {
      browser,
      server,
    },
    merge: {
      coverageFiles: mergeFiles,
    },
    sourceMaps: {
      search: config.sourceMaps?.search ?? [
        '.next/static/**/*.map',
        '.next/server/**/*.map',
        'dist/**/*.map',
        'build/**/*.map',
      ],
    },
    debug: {
      keepRaw: config.debug?.keepRaw ?? false,
    },
  }
}

function normalizeBooleanOrOptions<T extends Record<string, unknown>>(
  value: boolean | Partial<T> | undefined,
  defaults: T,
): T {
  if (value === false) {
    return {
      ...defaults,
      enabled: false,
    }
  }

  if (value === true || value === undefined) {
    return defaults
  }

  return {
    ...defaults,
    ...value,
  }
}
