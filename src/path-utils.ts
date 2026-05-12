import { fileURLToPath } from 'node:url'
import path from 'node:path'
import crypto from 'node:crypto'
import { existsSync } from 'node:fs'

export function slash(value: string): string {
  return value.replace(/\\/g, '/')
}

export function relativeToRoot(rootDir: string, file: string): string {
  const absolute = path.isAbsolute(file) ? file : path.resolve(rootDir, file)
  return slash(path.relative(rootDir, absolute))
}

export function absoluteFromRoot(rootDir: string, file: string): string {
  if (file.startsWith('file://')) return fileURLToPath(file)
  if (path.isAbsolute(file)) return path.normalize(file)
  return path.resolve(rootDir, file)
}

export function safeFilePart(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'artifact'
}

export function hashText(value: string): string {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 12)
}

export function resolveGeneratedFile(rootDir: string, urlOrPath: string): string | undefined {
  if (!urlOrPath) return undefined

  if (urlOrPath.startsWith('file://')) {
    return fileURLToPath(urlOrPath)
  }

  if (path.isAbsolute(urlOrPath)) {
    return urlOrPath
  }

  try {
    const url = new URL(urlOrPath)
    if (url.protocol === 'file:') return fileURLToPath(url)

    const pathname = decodeURIComponent(url.pathname)
    if (pathname.startsWith('/_next/static/')) {
      return path.join(rootDir, '.next/static', pathname.slice('/_next/static/'.length))
    }

    if (pathname.startsWith('/_next/')) {
      return path.join(rootDir, '.next', pathname.slice('/_next/'.length))
    }

    return undefined
  } catch {
    return path.resolve(rootDir, urlOrPath)
  }
}

export function normalizeCoverageFilePath(rootDir: string, file: string): string | undefined {
  if (!file) return undefined

  let normalized = slash(file)

  if (normalized.startsWith('file://')) {
    normalized = slash(fileURLToPath(normalized))
  }

  if (normalized.startsWith('webpack://')) {
    const marker = normalized.includes('/./') ? '/./' : undefined
    if (marker) {
      normalized = normalized.slice(normalized.indexOf(marker) + marker.length)
    } else {
      normalized = normalized.replace(/^webpack:\/\/[^/]+\//, '')
    }
  }

  normalized = normalized
    .replace(/^webpack-internal:\/\/\/?/, '')
    .replace(/^\.\/+/, '')
    .replace(/^\.\.\//, '')
    .replace(/\?.*$/, '')

  const nextWebpackMarker = '/_N_E/'
  const markerIndex = normalized.indexOf(nextWebpackMarker)
  if (markerIndex >= 0) {
    normalized = normalized.slice(markerIndex + nextWebpackMarker.length).replace(/^\.\/+/, '')
  }

  normalized = normalized.replace(/^_N_E\/\.?\//, '')

  if (
    normalized.includes('/node_modules/') ||
    normalized.startsWith('node_modules/') ||
    normalized.includes('/next/dist/') ||
    normalized.startsWith('next/dist/') ||
    normalized.includes('webpack/bootstrap')
  ) {
    return undefined
  }

  if (path.isAbsolute(normalized)) {
    if (existsSync(normalized)) return path.normalize(normalized)

    const nestedSourcePath = resolveNestedSourcePath(rootDir, normalized)
    if (nestedSourcePath) return nestedSourcePath

    if (
      (normalized.startsWith('/app/') || normalized.startsWith('/pages/') || normalized.startsWith('/src/'))
    ) {
      return path.resolve(rootDir, normalized.slice(1))
    }
    return path.normalize(normalized)
  }

  const resolved = path.resolve(rootDir, normalized)
  return resolveNestedSourcePath(rootDir, resolved) ?? resolved
}

export function isLikelyUserSource(rootDir: string, file: string): boolean {
  const rel = relativeToRoot(rootDir, file)
  return (
    !rel.startsWith('..') &&
    !rel.startsWith('.next/') &&
    !rel.includes('/node_modules/') &&
    !rel.startsWith('node_modules/')
  )
}

function resolveNestedSourcePath(rootDir: string, file: string): string | undefined {
  const normalized = slash(file)

  for (const marker of ['/src/', '/app/', '/pages/']) {
    const index = normalized.lastIndexOf(marker)
    if (index < 0) continue

    const candidate = path.resolve(rootDir, normalized.slice(index + 1))
    if (existsSync(candidate)) return candidate
  }

  return undefined
}
