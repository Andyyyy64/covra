import fs from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeConfig } from '../src/config.js'
import { buildCoverageMap } from '../src/convert.js'

describe('buildCoverageMap', () => {
  it('adds included but unexecuted source files as 0 percent coverage', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covra-'))
    await fs.mkdir(path.join(root, 'src'), { recursive: true })
    await fs.writeFile(path.join(root, 'src/example.ts'), 'export const value = 1\n')

    const config = normalizeConfig(
      {
        strict: false,
        collect: {
          browser: false,
          server: false,
        },
        include: ['src/**/*.ts'],
        outputDir: 'coverage/covra',
        rawDir: '.covra/raw',
      },
      root,
    )

    const result = await buildCoverageMap(config)
    const summary = result.coverageMap.getCoverageSummary().toJSON()

    expect(result.coverageMap.files()).toContain(path.join(realpathSync(root), 'src/example.ts'))
    expect(summary.lines.pct).toBe(0)
  })

  it('turns browser UI telemetry into route UX signals', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covra-ui-'))
    await fs.mkdir(path.join(root, 'app/settings'), { recursive: true })
    await fs.mkdir(path.join(root, '.covra/raw/browser'), { recursive: true })
    await fs.writeFile(path.join(root, 'app/settings/page.tsx'), 'export default function Page() { return null }\n')
    await fs.writeFile(
      path.join(root, '.covra/raw/browser/ui.json'),
      JSON.stringify({
        kind: 'browser-v8',
        version: 1,
        createdAt: new Date().toISOString(),
        test: { title: 'settings modal flow' },
        entries: [],
        uiEvents: [
          {
            kind: 'interaction',
            type: 'click',
            at: Date.now(),
            url: 'http://127.0.0.1:3000/settings',
            route: '/settings',
            target: { role: 'button', name: 'Open settings' },
          },
          {
            kind: 'dom-state',
            type: 'dialog.open',
            at: Date.now(),
            url: 'http://127.0.0.1:3000/settings',
            route: '/settings',
            target: { role: 'dialog', name: 'Settings' },
          },
          {
            kind: 'dom-state',
            type: 'form.validation.error',
            at: Date.now(),
            url: 'http://127.0.0.1:3000/settings',
            route: '/settings',
            target: { role: 'textbox', name: 'Email' },
          },
          {
            kind: 'dom-state',
            type: 'collection.items',
            at: Date.now(),
            url: 'http://127.0.0.1:3000/settings',
            route: '/settings',
            count: 100,
            target: { role: 'list', name: 'Review checklist', testId: 'review-checklist' },
          },
          {
            kind: 'network',
            type: 'request',
            at: Date.now(),
            url: 'http://127.0.0.1:3000/settings',
            route: '/settings',
            request: { method: 'POST', url: 'http://127.0.0.1:3000/api/settings', route: '/api/settings', status: 200 },
          },
        ],
      }),
    )

    const config = normalizeConfig(
      {
        strict: false,
        collect: {
          browser: true,
          server: false,
        },
        include: ['app/**/*.tsx'],
        outputDir: 'coverage/covra',
        rawDir: '.covra/raw',
      },
      root,
    )

    const result = await buildCoverageMap(config)
    const settings = result.routeInfo.get('/settings')
    const api = result.routeInfo.get('/api/settings')

    expect(settings?.tests).toContain('settings modal flow')
    expect(settings?.uiEvents).toContain('click: button "Open settings"')
    expect(settings?.uxStates).toContain('dialog.open')
    expect(settings?.uxStates).toContain('form.validation.error')
    expect(settings?.uxStates).toContain('collection.items')
    expect(settings?.uiEvents).toContain('collection.items: list "Review checklist" (100)')
    expect(settings?.apiCalls).toContain('POST /api/settings 200')
    expect(api?.apiCalls).toContain('POST /api/settings 200')
  })
})
