import type { BrowserCoverageArtifact, BrowserUiEvent, PlaywrightJSCoverageEntry } from './types.js'
import { writeBrowserCoverageArtifact } from './artifacts.js'
import { loadCovraConfig } from './config.js'
import type { BrowserContext, Page, Request, TestInfo } from '@playwright/test'

export type CovraUxMark = {
  route?: string
  state: string
  label?: string
}

const covraUxAnnotationType = 'covra:ux'

export type CovraPlaywrightFixtureOptions = {
  rawDir?: string
  cwd?: string
  config?: string
  enabled?: boolean
}

export function covraMark(testInfo: Pick<TestInfo, 'annotations'>, mark: CovraUxMark | string): void {
  const normalized = typeof mark === 'string' ? { state: mark } : mark
  testInfo.annotations.push({
    type: covraUxAnnotationType,
    description: JSON.stringify(normalized),
  })
}

export function covraFixture(options: CovraPlaywrightFixtureOptions = {}) {
  return {
    context: async (
      { context, browserName }: { context: BrowserContext; browserName: string },
      use: (context: BrowserContext) => Promise<void>,
      testInfo: TestInfo,
    ) => {
      const config = await loadCovraConfig({
        cwd: options.cwd ?? process.cwd(),
        config: options.config,
      })
      const enabled = options.enabled ?? true
      const rawDir = options.rawDir ?? config.rawDir

      if (!enabled || browserName !== 'chromium') {
        await use(context)
        return
      }

      const trackedPages = new Set<Page>()
      const navigations = new Set<string>()
      const requests = new Set<string>()
      const uiEvents: BrowserUiEvent[] = []
      const requestEvents = new WeakMap<Request, BrowserUiEvent>()
      const startPromises = new Set<Promise<void>>()
      const bindingName = `__covraRecordUxEvent_${testInfo.workerIndex}_${testInfo.retry}`
      const maxUiEvents = config.collect.browser.maxUiEvents
      const recordUiEvent = (event: BrowserUiEvent) => {
        if (!config.collect.browser.trackUiEvents) return
        if (uiEvents.length >= maxUiEvents) return
        uiEvents.push(event)
      }
      const rememberNavigation = (url: string) => {
        if (!url || url === 'about:blank') return
        navigations.add(url)
      }

      if (config.collect.browser.trackUiEvents) {
        await context.exposeBinding(bindingName, (_source, event: BrowserUiEvent) => {
          recordUiEvent(event)
        })
        await context.addInitScript(covraInstallUxTracker, { bindingName })
      }

      const startPage = (page: Page) => {
        if (trackedPages.has(page)) return
        trackedPages.add(page)
        rememberNavigation(page.url())
        if (config.collect.browser.trackUiEvents) {
          page.evaluate(covraInstallUxTracker, { bindingName }).catch(() => {
            // Some pages may navigate or close while the tracker is being installed.
          })
        }
        page.on('framenavigated', (frame) => {
          if (frame === page.mainFrame()) rememberNavigation(frame.url())
        })
        const promise = page.coverage
          .startJSCoverage({
            resetOnNavigation: config.collect.browser.resetOnNavigation,
            reportAnonymousScripts: config.collect.browser.reportAnonymousScripts,
          })
          .catch(() => {
            trackedPages.delete(page)
          })
          .finally(() => {
            startPromises.delete(promise)
          })
        startPromises.add(promise)
      }

      for (const page of context.pages()) {
        startPage(page)
      }

      context.on('page', startPage)
      context.on('request', (request) => {
        const requestUrl = request.url()
        requests.add(requestUrl)
        if (config.collect.browser.trackUiEvents) {
          const resourceType = request.resourceType()
          const requestRoute = routeFromUrl(requestUrl)
          if (!shouldRecordNetworkEvent(resourceType, requestRoute, requestUrl)) return
          const event: BrowserUiEvent = {
            kind: 'network',
            type: 'request',
            at: Date.now(),
            url: pageUrlForRequest(request),
            route: routeFromUrl(pageUrlForRequest(request)),
            request: {
              method: request.method(),
              url: requestUrl,
              route: requestRoute,
              resourceType,
            },
          }
          recordUiEvent(event)
          requestEvents.set(request, event)
        }
      })
      context.on('response', (response) => {
        const event = requestEvents.get(response.request())
        if (event?.request) {
          event.request.status = response.status()
        }
      })

      await use(context)
      await Promise.allSettled([...startPromises])
      if (config.collect.browser.trackUiEvents) {
        await flushUxTrackers(trackedPages, bindingName)
      }

      const entries: PlaywrightJSCoverageEntry[] = []
      for (const page of trackedPages) {
        rememberNavigation(page.url())
        try {
          entries.push(...(await page.coverage.stopJSCoverage()))
        } catch {
          // Playwright can throw if a page is closed before coverage stops.
          // The remaining pages still produce useful coverage.
        }
      }

      if (entries.length > 0) {
        await writeBrowserCoverageArtifact({
          rawDir,
          entries,
          navigations: [...navigations],
          requests: [...requests],
          uiEvents,
          test: toArtifactTestInfo(testInfo),
        })
      }
    },
  }
}

async function flushUxTrackers(pages: Set<Page>, bindingName: string): Promise<void> {
  const flushKey = `__covraFlushUxTracker_${bindingName}`
  await Promise.allSettled(
    [...pages].map(async (page) => {
      await page.evaluate(async (key) => {
        const win = window as unknown as Record<string, unknown>
        const flush = win[key]
        if (typeof flush === 'function') {
          await (flush as () => Promise<void>)()
        }
      }, flushKey)
    }),
  )
}

function pageUrlForRequest(request: Request): string | undefined {
  try {
    return request.frame().url()
  } catch {
    return undefined
  }
}

function routeFromUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
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

function shouldRecordNetworkEvent(resourceType: string, route: string | undefined, url: string): boolean {
  if (isStaticAssetRequest(url, route)) return false
  return resourceType === 'fetch' || resourceType === 'xhr' || Boolean(route?.startsWith('/api/'))
}

function isStaticAssetRequest(value: string, route: string | undefined): boolean {
  if (route?.startsWith('/api/')) return false
  try {
    const url = new URL(value)
    if (url.pathname.startsWith('/_next/static/')) return true
    if (url.pathname.startsWith('/_next/image')) return true
    if (url.pathname === '/favicon.ico') return true
    return /\.(?:css|js|mjs|map|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf)$/i.test(url.pathname)
  } catch {
    return false
  }
}

function covraInstallUxTracker(options: { bindingName: string }): void {
  const win = window as unknown as Record<string, unknown>
  const installedKey = `__covraUxTrackerInstalled_${options.bindingName}`
  if (win[installedKey]) return
  win[installedKey] = true

  const binding = () => win[options.bindingName] as ((event: BrowserUiEvent) => Promise<void>) | undefined
  const pendingRecords = new Set<Promise<void>>()
  const seenStates = new Set<string>()
  let scanTimer: number | undefined

  const record = (event: Omit<BrowserUiEvent, 'at'> & { at?: number }) => {
    const fn = binding()
    if (typeof fn !== 'function') return
    const promise = fn({
      ...event,
      at: event.at ?? Date.now(),
      url: event.url ?? location.href,
      route: event.route ?? routeFromLocation(location.href),
    })
    pendingRecords.add(promise)
    void promise.catch(() => undefined).finally(() => pendingRecords.delete(promise))
  }

  const recordInteraction = (event: Event, type = event.type) => {
    const element = eventTargetElement(event)
    record({
      kind: 'interaction',
      type,
      target: summarizeElement(element),
      key: event instanceof KeyboardEvent ? event.key : undefined,
      checked: element instanceof HTMLInputElement && isCheckableInput(element) ? element.checked : undefined,
    })
    scheduleDomScan()
  }

  document.addEventListener('click', recordInteraction, true)
  document.addEventListener('change', recordInteraction, true)
  document.addEventListener('submit', recordInteraction, true)
  document.addEventListener(
    'keydown',
    (event) => {
      if (['Enter', 'Escape', ' ', 'Spacebar'].includes(event.key)) {
        recordInteraction(event, `key:${event.key === ' ' ? 'Space' : event.key}`)
      }
    },
    true,
  )

  const observer = new MutationObserver(() => scheduleDomScan())
  observer.observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ['open', 'aria-expanded', 'aria-hidden', 'hidden', 'class', 'style', 'data-state'],
  })

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanDomStates, { once: true })
  } else {
    scanDomStates()
  }

  win[`__covraFlushUxTracker_${options.bindingName}`] = async () => {
    if (scanTimer !== undefined) {
      window.clearTimeout(scanTimer)
      scanTimer = undefined
    }
    scanDomStates()
    await Promise.allSettled([...pendingRecords])
  }

  function scheduleDomScan() {
    if (scanTimer !== undefined) return
    scanTimer = window.setTimeout(() => {
      scanTimer = undefined
      scanDomStates()
    }, 80)
  }

  function scanDomStates() {
    for (const element of document.querySelectorAll('dialog[open], [role="dialog"], [aria-modal="true"]')) {
      emitDomState('dialog.open', element)
    }

    for (const element of document.querySelectorAll('[role="menu"], [role="listbox"], [aria-expanded="true"], [popover]')) {
      if (element.hasAttribute('popover') && !isOpenPopover(element)) continue
      emitDomState('disclosure.open', element)
    }

    for (const element of document.querySelectorAll('[role="alert"], [aria-live]')) {
      emitDomState('alert.visible', element)
    }

    for (const element of document.querySelectorAll('[aria-invalid="true"], input:invalid, textarea:invalid, select:invalid')) {
      emitDomState('form.validation.error', element)
    }

    for (const element of document.querySelectorAll('[aria-busy="true"], [role="progressbar"], [data-state="loading"], [data-loading="true"], [data-testid*="loading" i], [data-testid*="spinner" i]')) {
      emitDomState('loading.visible', element)
    }

    for (const element of document.querySelectorAll('[data-empty], [data-state="empty"], [data-testid*="empty" i], [data-testid*="no-results" i], [data-testid*="not-found" i], [role="status"]')) {
      const name = accessibleName(element)?.toLowerCase() ?? ''
      if (!name || /empty|no results|no items|not found|なし|ありません|見つかりません/.test(name)) {
        emitDomState('empty-state.visible', element)
      }
      if (/forbidden|unauthorized|permission|権限|許可/.test(name)) {
        emitDomState('permission.denied', element)
      }
    }

    for (const element of document.querySelectorAll('[role="list"], [role="table"], [role="grid"], table, [data-testid*="list" i], [data-testid*="table" i], [data-testid*="checklist" i]')) {
      const count = countRowsOrItems(element)
      if (count > 0 && (count >= 20 || hasSemanticListRole(element) || hasTestId(element))) {
        emitDomState('collection.items', element, count)
      }
    }
  }

  function emitDomState(type: string, element: Element, count?: number) {
    if (element.id === '__next-route-announcer__') return
    if (!isVisible(element)) return
    const target = summarizeElement(element)
    const key = [type, location.pathname, target?.selector, target?.name, count ?? ''].join('|')
    if (seenStates.has(key)) return
    seenStates.add(key)
    record({
      kind: 'dom-state',
      type,
      target,
      count,
      state: count === undefined ? type : `${type}:${count}`,
    })
  }

  function eventTargetElement(event: Event): Element | undefined {
    const target = event.composedPath?.()[0] ?? event.target
    if (target instanceof Element) return target
    if (target instanceof Node && target.parentElement) return target.parentElement
    return undefined
  }

  function summarizeElement(element: Element | undefined): BrowserUiEvent['target'] {
    if (!element) return undefined
    const tag = element.tagName.toLowerCase()
    const role = element.getAttribute('role') ?? inferredRole(element)
    const testId = element.getAttribute('data-testid') ?? element.getAttribute('data-test') ?? element.getAttribute('data-cy') ?? undefined
    const name = accessibleName(element)
    return {
      tag,
      role,
      testId,
      name,
      selector: stableSelector(element),
    }
  }

  function inferredRole(element: Element): string | undefined {
    const tag = element.tagName.toLowerCase()
    if (tag === 'button') return 'button'
    if (tag === 'a') return 'link'
    if (tag === 'form') return 'form'
    if (tag === 'dialog') return 'dialog'
    if (tag === 'select') return 'combobox'
    if (tag === 'textarea') return 'textbox'
    if (tag === 'table') return 'table'
    if (tag === 'ul' || tag === 'ol') return 'list'
    if (element instanceof HTMLInputElement) {
      if (element.type === 'checkbox') return 'checkbox'
      if (element.type === 'radio') return 'radio'
      if (element.type === 'submit' || element.type === 'button') return 'button'
      return 'textbox'
    }
    return undefined
  }

  function accessibleName(element: Element): string | undefined {
    const raw =
      element.getAttribute('aria-label') ??
      element.getAttribute('title') ??
      element.getAttribute('alt') ??
      element.getAttribute('placeholder') ??
      element.getAttribute('name') ??
      element.textContent ??
      undefined
    return trimText(raw)
  }

  function trimText(value: string | null | undefined): string | undefined {
    const text = value?.replace(/\s+/g, ' ').trim()
    if (!text) return undefined
    return text.length > 80 ? `${text.slice(0, 77)}...` : text
  }

  function stableSelector(element: Element): string {
    const tag = element.tagName.toLowerCase()
    const id = element.id ? `#${cssEscape(element.id)}` : ''
    const testId = element.getAttribute('data-testid') ?? element.getAttribute('data-test') ?? element.getAttribute('data-cy')
    const role = element.getAttribute('role')
    if (testId) return `${tag}[data-testid="${cssEscape(testId)}"]`
    if (id) return `${tag}${id}`
    if (role) return `${tag}[role="${cssEscape(role)}"]`
    return tag
  }

  function cssEscape(value: string): string {
    return value.replace(/"/g, '\\"').replace(/\\/g, '\\\\')
  }

  function routeFromLocation(value: string): string | undefined {
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

  function isVisible(element: Element): boolean {
    if (element instanceof HTMLDialogElement && !element.open) return false
    if (element.hasAttribute('hidden')) return false
    const style = window.getComputedStyle(element)
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
    return element.getClientRects().length > 0
  }

  function isOpenPopover(element: Element): boolean {
    try {
      return element.matches(':popover-open')
    } catch {
      return element.getAttribute('data-state') === 'open'
    }
  }

  function countRowsOrItems(element: Element): number {
    const rows = element.querySelectorAll('[role="row"], tr')
    if (rows.length > 0) return rows.length
    return element.querySelectorAll('[role="listitem"], li, [data-testid*="item" i], [data-testid*="row" i]').length
  }

  function hasSemanticListRole(element: Element): boolean {
    const role = element.getAttribute('role')
    const tag = element.tagName.toLowerCase()
    return role === 'list' || role === 'table' || role === 'grid' || tag === 'table'
  }

  function hasTestId(element: Element): boolean {
    return Boolean(element.getAttribute('data-testid') ?? element.getAttribute('data-test') ?? element.getAttribute('data-cy'))
  }

  function isCheckableInput(element: HTMLInputElement): boolean {
    return element.type === 'checkbox' || element.type === 'radio'
  }
}

export const coverageFixture = covraFixture

function toArtifactTestInfo(testInfo: TestInfo): BrowserCoverageArtifact['test'] {
  return {
    title: testInfo.title,
    file: testInfo.file,
    project: testInfo.project?.name,
    workerIndex: testInfo.workerIndex,
    retry: testInfo.retry,
    status: testInfo.status,
    annotations: testInfo.annotations
      .filter((annotation) => annotation.type === covraUxAnnotationType)
      .map((annotation) => ({
        type: annotation.type,
        description: annotation.description,
      })),
  }
}
