import { defineCovraConfig } from '../../dist/index.js'

export default defineCovraConfig({
  framework: 'next',
  rootDir: '.',
  collect: {
    browser: true,
    server: true,
  },
  include: [
    'app/**/*.{ts,tsx}',
    'pages/**/*.{ts,tsx}',
    'src/**/*.{ts,tsx}',
  ],
  exclude: [
    '**/*.test.*',
    '**/*.spec.*',
  ],
  all: true,
  reports: ['text-summary', 'html', 'lcov', 'json', 'json-summary'],
  thresholds: {
    lines: 10,
    statements: 10,
    functions: 0,
    branches: -200,
  },
})
