#!/usr/bin/env node
import { cac } from 'cac'
import { readFileSync } from 'node:fs'
import {
  checkCommand,
  cleanCommand,
  doctorCommand,
  explainCommand,
  initCommand,
  reportCommand,
  runCommand,
  startServerCommand,
} from './commands.js'

const cli = cac('covra')
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version?: string
}

cli
  .command('init', 'Create a starter Covra config and Playwright fixture')
  .option('--dry-run', 'Print files instead of writing them')
  .action(async (options) => {
    process.exitCode = await initCommand({ dryRun: Boolean(options.dryRun) })
  })

cli
  .command('clean', 'Remove Covra raw artifacts and reports')
  .option('-c, --config <file>', 'Config file')
  .action(async (options) => {
    process.exitCode = await cleanCommand({ config: options.config })
  })

cli
  .command('doctor', 'Inspect Covra, Next.js, Playwright, and coverage artifacts')
  .option('-c, --config <file>', 'Config file')
  .option('--post-run', 'Require runtime artifacts and source maps from a completed coverage run')
  .action(async (options) => {
    process.exitCode = await doctorCommand({ config: options.config, postRun: Boolean(options.postRun) })
  })

cli
  .command('report', 'Convert raw V8 artifacts and write coverage reports')
  .option('-c, --config <file>', 'Config file')
  .option('--check', 'Evaluate configured thresholds after writing reports')
  .action(async (options) => {
    process.exitCode = await reportCommand({
      config: options.config,
      check: Boolean(options.check),
    })
  })

cli
  .command('check [coverageFile]', 'Evaluate thresholds against coverage-final.json')
  .option('-c, --config <file>', 'Config file')
  .action(async (coverageFile, options) => {
    process.exitCode = await checkCommand({
      config: options.config,
      coverageFile,
    })
  })

cli
  .command('explain <file>', 'Explain one file in the latest Covra report')
  .option('-c, --config <file>', 'Config file')
  .action(async (file, options) => {
    process.exitCode = await explainCommand(file, { config: options.config })
  })

cli
  .command('start-server [...command]', 'Run a server command with NODE_V8_COVERAGE configured')
  .option('-c, --config <file>', 'Config file')
  .allowUnknownOptions()
  .action(async (command, options) => {
    process.exitCode = await startServerCommand(commandFromDoubleDash('start-server') ?? command ?? [], {
      config: options.config,
    })
  })

cli
  .command('run [...command]', 'Run Playwright, then generate and check Covra coverage')
  .option('-c, --config <file>', 'Config file')
  .option('--no-check', 'Skip threshold checks')
  .allowUnknownOptions()
  .action(async (command, options) => {
    process.exitCode = await runCommand(commandFromDoubleDash('run') ?? command ?? [], {
      config: options.config,
      check: options.check,
    })
  })

cli.help()
cli.version(packageJson.version ?? '0.0.0')
cli.parse()

function commandFromDoubleDash(commandName: string): string[] | undefined {
  const args = process.argv.slice(2)
  const commandIndex = args.indexOf(commandName)
  if (commandIndex < 0) return undefined

  const rest = args.slice(commandIndex + 1)
  const separatorIndex = rest.indexOf('--')
  if (separatorIndex < 0) return undefined

  return rest.slice(separatorIndex + 1)
}
