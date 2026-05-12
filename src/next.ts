type NextConfig = Record<string, unknown> & {
  productionBrowserSourceMaps?: boolean
  experimental?: Record<string, unknown>
}

export function withCovra<T extends NextConfig>(nextConfig: T): T {
  if (!isCovraEnabled()) return nextConfig

  return {
    ...nextConfig,
    productionBrowserSourceMaps: true,
    experimental: {
      ...nextConfig.experimental,
      serverSourceMaps: true,
    },
  }
}

export const withE2ECoverage = withCovra

function isCovraEnabled(): boolean {
  return (
    process.env.COVRA === '1' ||
    process.env.COVRA_COVERAGE === '1' ||
    process.env.E2E_COVERAGE === '1'
  )
}
