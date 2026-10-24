/**
 * Verifies the published install path end to end: packs this repo, installs
 * the tarball for production, and runs `canon init` from it into a fresh
 * project. Runs on Bun alone.
 */
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  intro,
  logError,
  logInfo,
  logStep,
  outro,
  pipeOutput,
} from '../../src/cli/ui'

const root = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const tmpRoot = join(root, '.canon/tmp/install-check')
const packDir = join(tmpRoot, 'pack')
const extractDir = join(tmpRoot, 'extract')
const targetDir = join(tmpRoot, 'target')

const HELP = `Usage: scripts/core/install-check.ts [--keep]

Verifies the published install path end to end:
  1. Packs this repo into a tarball at .canon/tmp/install-check/pack
  2. Extracts it and asserts sandbox is absent from the tree
  3. Runs bun install --production in the extracted tree
  4. Runs the CLI with --help from the extracted tree to confirm it resolves
  5. Scaffolds a fresh project in .canon/tmp/install-check/target
  6. Runs canon init from the extracted package and asserts a scaffold landed

Flags:
  --keep    Keep the tmp tree on exit for inspection
`

/**
 * Every domain canon init installs needs at least one path here. A domain with
 * no assertion can truncate silently: init still exits 0 because run_domain
 * catches a failed domain, and the gate stays green while the target is
 * missing everything that domain provides.
 *
 * Authoring references name no path because they ship inside the plugin's
 * skills rather than installing into a target. The two rule paths stand for
 * the `claude` and `canon` groups `base` takes whole.
 */
const SCAFFOLD_PATHS = [
  'CLAUDE.md',
  '.claude',
  'canon/context/index.md',
  '.oxfmtrc.json',
  '.lintstagedrc',
  '.husky/pre-commit',
  '.github/workflows/verify.yml',
  'scripts/verify.ts',
  '.claude/rules/canon/claude/output.md',
  '.claude/rules/canon/canon/scratch.md',
]

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(HELP)
  process.exit(0)
}
const keep = args.includes('--keep')

/** Runs a command to completion, showing its output inside the frame. */
function run(
  failure: string,
  cmd: string[],
  opts: { cwd?: string; show?: boolean } = {},
): string {
  const result = Bun.spawnSync(cmd, {
    cwd: opts.cwd ?? root,
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const stdout = result.stdout.toString()
  const output = `${stdout}${result.stderr.toString()}`.trim()
  if (opts.show && output !== '') pipeOutput(output)
  if (result.exitCode !== 0) {
    if (!opts.show && output !== '') pipeOutput(output)
    throw new Error(failure)
  }
  return stdout
}

function check(): void {
  logStep('Assert excluded path exists in source')
  // An absence check over a path the source tree no longer holds passes on
  // nothing, so the excluded tree has to exist here before its absence below
  // can mean the publish left it out.
  if (!existsSync(join(root, 'sandbox/exempt.toml'))) {
    throw new Error(
      'sandbox/exempt.toml is missing from the source tree, so the absence check below would pass on nothing',
    )
  }
  logInfo('Present: sandbox/exempt.toml')

  logStep('Pack')
  const packed = run('bun pm pack failed', [
    'bun',
    'pm',
    'pack',
    '--quiet',
    '--ignore-scripts',
    '--destination',
    packDir,
  ])
  const tarball = packed.trim().split('\n').pop() ?? ''
  logInfo(`Packed to ${tarball}`)

  logStep('Extract')
  run('tar extract failed', [
    'tar',
    '-xzf',
    tarball,
    '-C',
    extractDir,
    '--strip-components=1',
  ])
  logInfo(`Extracted to ${extractDir}`)

  logStep('Assert excluded path is absent')
  if (existsSync(join(extractDir, 'sandbox'))) {
    throw new Error(
      'sandbox shipped in the tarball, and the files field in package.json leaves it out',
    )
  }
  logInfo('Absent: sandbox')

  logStep('Install dependencies (production)')
  run(
    'bun install --production failed',
    ['bun', 'install', '--production', '--ignore-scripts', '--silent'],
    { cwd: extractDir, show: true },
  )
  logInfo('Dependencies installed without devDependencies')

  logStep('Confirm CLI runs')
  run('canon --help failed', ['bun', 'run', 'src/cli.ts', '--help'], {
    cwd: extractDir,
  })
  logInfo('canon --help ran clean from the extracted package')

  logStep('Scaffold fresh project')
  mkdirSync(targetDir, { recursive: true })
  run('git init failed', ['git', 'init', '--quiet'], { cwd: targetDir })
  logInfo(`Initialized git in ${targetDir}`)

  logStep('Run canon init')
  run(
    'canon init failed',
    ['bun', 'run', join(extractDir, 'src/cli.ts'), 'init', '--stack', 'base'],
    { cwd: targetDir, show: true },
  )
  logInfo('canon init completed')

  logStep('Assert scaffold')
  for (const path of SCAFFOLD_PATHS) {
    if (!existsSync(join(targetDir, path))) {
      throw new Error(`Missing after canon init: ${path}`)
    }
    logInfo(`Found: ${path}`)
  }

  logStep('Verification passed')
  logInfo('Manual check still needed: bun link and global canon invocation')
}

rmSync(tmpRoot, { recursive: true, force: true })
mkdirSync(packDir, { recursive: true })
mkdirSync(extractDir, { recursive: true })

intro('Install verification')
let failed = false
try {
  check()
} catch (error) {
  failed = true
  logError(error instanceof Error ? error.message : String(error))
} finally {
  if (keep) {
    logInfo(`Kept artifacts at ${tmpRoot}`)
  } else {
    rmSync(tmpRoot, { recursive: true, force: true })
  }
  outro()
}
process.exit(failed ? 1 : 0)
