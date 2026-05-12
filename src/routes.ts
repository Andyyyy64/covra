import { relativeToRoot } from './path-utils.js'

export type RouteKind =
  | 'app-page'
  | 'app-layout'
  | 'app-route'
  | 'pages-page'
  | 'pages-api'
  | 'pages-special'

export type RouteInfo = {
  route: string
  kind: RouteKind
}

const sourceExtensionPattern = /\.(?:js|jsx|ts|tsx)$/

export function routeInfoForFile(rootDir: string, file: string): RouteInfo | undefined {
  const relative = relativeToRoot(rootDir, file)
  const rawParts = relative.split('/')
  const parts = rawParts[0] === 'src' && (rawParts[1] === 'app' || rawParts[1] === 'pages')
    ? rawParts.slice(1)
    : rawParts

  if (parts[0] === 'app') {
    return appRouteInfo(parts)
  }

  if (parts[0] === 'pages') {
    return pagesRouteInfo(parts)
  }

  return undefined
}

function appRouteInfo(parts: string[]): RouteInfo | undefined {
  const filename = parts.at(-1)
  if (!filename) return undefined

  const kind = appRouteKind(filename)
  if (!kind) return undefined

  const routeParts = parts.slice(1, -1).filter(isPublicAppSegment)
  return {
    route: routeFromSegments(routeParts),
    kind,
  }
}

function appRouteKind(filename: string): RouteKind | undefined {
  if (/^page\.(?:js|jsx|ts|tsx)$/.test(filename)) return 'app-page'
  if (/^layout\.(?:js|jsx|ts|tsx)$/.test(filename)) return 'app-layout'
  if (/^route\.(?:js|jsx|ts|tsx)$/.test(filename)) return 'app-route'
  return undefined
}

function pagesRouteInfo(parts: string[]): RouteInfo | undefined {
  const filename = parts.at(-1)
  if (!filename) return undefined

  const routeParts = parts.slice(1)
  const basename = filename.replace(sourceExtensionPattern, '')

  if (routeParts[0] === 'api') {
    const apiParts = routeParts.map((part, index) => {
      if (index === routeParts.length - 1) return basename === 'index' ? '' : basename
      return part
    }).filter(Boolean)
    return {
      route: routeFromSegments(apiParts),
      kind: 'pages-api',
    }
  }

  if (basename.startsWith('_')) {
    return {
      route: `/${basename}`,
      kind: 'pages-special',
    }
  }

  const publicParts = routeParts.map((part, index) => {
    if (index === routeParts.length - 1) return basename === 'index' ? '' : basename
    return part
  }).filter(Boolean)

  return {
    route: routeFromSegments(publicParts),
    kind: 'pages-page',
  }
}

function routeFromSegments(segments: string[]): string {
  const normalized = segments.map(normalizeSegment).filter(Boolean)
  return normalized.length === 0 ? '/' : `/${normalized.join('/')}`
}

function normalizeSegment(segment: string): string {
  return segment
    .replace(/^\[\.\.\.(.+)\]$/, '[...$1]')
    .replace(/^\[\[(\.\.\..+)\]\]$/, '[[$1]]')
}

function isPublicAppSegment(segment: string): boolean {
  if (segment.startsWith('(') && segment.endsWith(')')) return false
  if (segment.startsWith('@')) return false
  return !segment.startsWith('_')
}

export function routeSortKey(info: RouteInfo): string {
  return `${routeKindRank(info.kind)}:${info.route}`
}

function routeKindRank(kind: RouteKind): number {
  switch (kind) {
    case 'app-page':
      return 0
    case 'pages-page':
      return 1
    case 'app-route':
      return 2
    case 'pages-api':
      return 3
    case 'app-layout':
      return 4
    case 'pages-special':
      return 5
  }
}
