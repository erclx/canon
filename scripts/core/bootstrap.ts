/**
 * Installs dependencies, links the canon CLI globally, and appends the marked
 * alias block to the user's `.zshrc`, the only file this writes outside the
 * repository. Runs on Bun alone, so a stock macOS bash 3.2 never enters it.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import {
  intro,
  logAdd,
  logError,
  logInfo,
  logStep,
  logWarn,
  outro,
} from '../../src/cli/ui'

const root = new URL('../..', import.meta.url).pathname.replace(/\/$/, '')

const MARKER_OPEN = '# >>> canon aliases >>>'
const MARKER_CLOSE = '# <<< canon aliases <<<'

function zshrcPath(): string {
  const dir = process.env.ZDOTDIR
  return join(dir !== undefined && dir !== '' ? dir : homedir(), '.zshrc')
}

/** `$TOOLKIT` stays a literal in the block, so the shell expands it on load. */
function aliasBlock(): string {
  return `${MARKER_OPEN}
TOOLKIT="${root}"
export CLAUDE_CODE_ENABLE_TODO_TOOLS=1

alias cl='claude'
alias clr='cl -r'
alias clc='cl -c'
alias clw='cl -w'
alias cls='cl --model sonnet'

alias clp='claude --plugin-dir $TOOLKIT/claude'
alias clpc='clp -c'
alias clps='clp --model sonnet'
alias clpa='clp agents'
alias clpac='clpa --cwd .'
${MARKER_CLOSE}`
}

function run(step: string, cmd: string[]): void {
  const result = Bun.spawnSync(cmd, {
    cwd: root,
    stdout: 'ignore',
    stderr: 'pipe',
  })
  if (result.exitCode !== 0) {
    throw new Error(`${step} failed: ${result.stderr.toString().trim()}`)
  }
}

function installCli(): void {
  logStep('Installing the canon CLI')
  run('bun install', ['bun', 'install', '--cwd', root])
  run('bun link', ['bun', 'link', '--cwd', root])
  logInfo('Dependencies installed and canon linked')
}

function installAliases(): void {
  const zshrc = zshrcPath()
  logStep('Installing Claude Code shell aliases')
  logInfo(
    `This step manages a marked alias block in ${zshrc}, the only file outside the repo this script writes.`,
  )
  logInfo(
    'Delete the block and its two marker comments to remove the aliases. Re-running never adds a second copy.',
  )

  const existing = existsSync(zshrc) ? readFileSync(zshrc, 'utf8') : ''
  if (existing.includes(MARKER_OPEN)) {
    logInfo(`Aliases already present in ${zshrc}, skipping`)
    return
  }
  if (/^alias clp=/m.test(existing)) {
    logWarn(
      `An unmanaged clp alias is already in ${zshrc}. Leaving it untouched.`,
    )
    logWarn('Remove it and re-run to switch to the managed block.')
    return
  }

  appendFileSync(zshrc, `\n${aliasBlock()}\n`)
  logAdd(`Appended canon alias block to ${zshrc}`)
  logInfo(`Run 'source ${zshrc}' or open a new shell to load them`)
}

function verifyCli(): void {
  logStep('Verifying the install')
  const result = Bun.spawnSync(['canon', '--help'], {
    stdout: 'ignore',
    stderr: 'ignore',
  })
  if (result.exitCode === 0) {
    logInfo('canon resolves on PATH')
  } else {
    logWarn(
      'canon not on PATH yet. Ensure $BUN_INSTALL/bin is exported, then re-open your shell.',
    )
  }
}

intro('canon bootstrap')
let failed = false
try {
  installCli()
  installAliases()
  verifyCli()
} catch (error) {
  failed = true
  logError(error instanceof Error ? error.message : String(error))
} finally {
  outro()
}
process.exit(failed ? 1 : 0)
