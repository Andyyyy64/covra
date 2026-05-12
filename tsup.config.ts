import { defineConfig } from 'tsup'

const esmEntries = {
  index: 'src/index.ts',
  cli: 'src/cli.ts',
  'server-agent': 'src/server-agent.ts',
  playwright: 'src/playwright.ts',
  next: 'src/next.ts',
}

const cjsEntries = {
  index: 'src/index.ts',
  playwright: 'src/playwright.ts',
  next: 'src/next.ts',
}

export default defineConfig([
  {
    entry: esmEntries,
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    target: 'node20',
  },
  {
    entry: cjsEntries,
    format: ['cjs'],
    dts: false,
    sourcemap: true,
    clean: false,
    splitting: false,
    target: 'node20',
    outExtension() {
      return {
        js: '.cjs',
      }
    },
  },
])
