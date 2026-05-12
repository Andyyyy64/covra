import { describe, expect, it } from 'vitest'
import { routeInfoForFile } from '../src/routes.js'

describe('routeInfoForFile', () => {
  it('maps App Router source files to public routes', () => {
    expect(routeInfoForFile('/repo', '/repo/app/page.tsx')).toEqual({
      route: '/',
      kind: 'app-page',
    })
    expect(routeInfoForFile('/repo', '/repo/app/dashboard/page.tsx')).toEqual({
      route: '/dashboard',
      kind: 'app-page',
    })
    expect(routeInfoForFile('/repo', '/repo/app/(marketing)/pricing/page.tsx')).toEqual({
      route: '/pricing',
      kind: 'app-page',
    })
    expect(routeInfoForFile('/repo', '/repo/app/api/health/route.ts')).toEqual({
      route: '/api/health',
      kind: 'app-route',
    })
  })

  it('maps Pages Router files to public routes', () => {
    expect(routeInfoForFile('/repo', '/repo/pages/index.tsx')).toEqual({
      route: '/',
      kind: 'pages-page',
    })
    expect(routeInfoForFile('/repo', '/repo/pages/home/about.tsx')).toEqual({
      route: '/home/about',
      kind: 'pages-page',
    })
    expect(routeInfoForFile('/repo', '/repo/pages/api/legacy.ts')).toEqual({
      route: '/api/legacy',
      kind: 'pages-api',
    })
    expect(routeInfoForFile('/repo', '/repo/pages/_app.tsx')).toEqual({
      route: '/_app',
      kind: 'pages-special',
    })
  })
})
