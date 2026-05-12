type NextConfigLike = {
  productionBrowserSourceMaps?: boolean
  experimental?: object
}

export function withCovra<T extends NextConfigLike>(nextConfig: T): T {
  if (!isCovraEnabled()) return nextConfig

  const experimental =
    typeof nextConfig.experimental === 'object' && nextConfig.experimental !== null ? nextConfig.experimental : {}

  return {
    ...nextConfig,
    productionBrowserSourceMaps: true,
    experimental: {
      ...experimental,
      serverSourceMaps: true,
    },
  } as T
}

export const withE2ECoverage = withCovra

function isCovraEnabled(): boolean {
  return (
    process.env.COVRA === '1' ||
    process.env.COVRA_COVERAGE === '1' ||
    process.env.E2E_COVERAGE === '1'
  )
}
