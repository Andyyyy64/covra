import { takeCoverage } from 'node:v8'

let flushing = false

function flushCoverage() {
  if (flushing || !process.env.NODE_V8_COVERAGE) return
  flushing = true
  try {
    takeCoverage()
  } catch {
    // Coverage flushing must never make the application fail shutdown.
  } finally {
    flushing = false
  }
}

const intervalMs = Number(process.env.COVRA_SERVER_COVERAGE_INTERVAL_MS ?? 500)
if (Number.isFinite(intervalMs) && intervalMs > 0) {
  setInterval(flushCoverage, intervalMs).unref()
}

process.once('SIGTERM', () => {
  flushCoverage()
  process.exit(0)
})

process.once('SIGINT', () => {
  flushCoverage()
  process.exit(130)
})

process.once('beforeExit', flushCoverage)
