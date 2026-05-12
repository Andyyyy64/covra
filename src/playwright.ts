import type { BrowserCoverageArtifact, PlaywrightJSCoverageEntry } from './types.js'
import { writeBrowserCoverageArtifact } from './artifacts.js'
import { loadCovraConfig } from './config.js'
import type { BrowserContext, Page, TestInfo } from '@playwright/test'

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
      const startPromises = new Set<Promise<void>>()
      const startPage = (page: Page) => {
        if (trackedPages.has(page)) return
        trackedPages.add(page)
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

      await use(context)
      await Promise.allSettled([...startPromises])

      const entries: PlaywrightJSCoverageEntry[] = []
      for (const page of trackedPages) {
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
          test: toArtifactTestInfo(testInfo),
        })
      }
    },
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
