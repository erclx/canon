import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { constants, homedir } from 'node:os'
import type { Command } from 'commander'
import {
  AGENT_CLI,
  CHROMIUM_REVISION,
  INSTALL_AGENT_BROWSER,
  browsersRoot,
  planAgentCall,
} from '@/browser/agent-cli'

/**
 * Every byte on stdout and stderr belongs to the child, which skills read
 * snapshot paths and `--raw eval` values off, so this verb frames nothing and
 * marks its own refusals with a prefix rather than a record.
 */
const FORWARDED_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const

export function register(program: Command): void {
  program
    .command('browser')
    .description('Drive the pinned agent browser CLI')
    .argument('[args...]', 'Words passed to the browser CLI untouched')
    .helpOption('-h, --help', 'Show this help message')
    .allowUnknownOption()
    .allowExcessArguments(true)
    .passThroughOptions()
    .addHelpText(
      'after',
      [
        '',
        `Runs ${AGENT_CLI} through bunx in the current directory, so every`,
        'skill driving a page reaches one version. Snapshots land under',
        '.playwright-cli/ in the folder it runs in.',
        '',
        'open is forced onto the bundled Chromium unless the call names a',
        `--browser, and refuses rather than downloading when revision ${CHROMIUM_REVISION}`,
        'is absent. Install it once, outside any pass, with:',
        `  ${INSTALL_AGENT_BROWSER}`,
        '',
        "Stdout, stderr, and the exit code are the browser CLI's. A refusal of",
        "this verb's own reads 'canon browser:' on stderr.",
        '',
        'Exit codes:',
        "  n  the browser CLI's own exit code",
        '  1  refused, with the reason on stderr',
        '',
        'Examples:',
        '  canon browser --version',
        '  canon browser -s=canon-12 open http://localhost:4321',
        '  canon browser -s=canon-12 --raw eval "document.title"',
        '',
      ].join('\n'),
    )
    .action(async (args: string[]) => {
      process.exitCode = await runBrowser(args)
    })
}

async function runBrowser(args: readonly string[]): Promise<number> {
  if (Bun.which('bunx') === null) {
    return refuse('bunx is not on PATH, so the pinned CLI cannot run')
  }

  const root = browsersRoot(process.env, process.platform, homedir())
  const call = planAgentCall(args, () =>
    existsSync(`${root}/chromium-${CHROMIUM_REVISION}`),
  )
  if (call.kind === 'refused') return refuse(call.message)

  const child = spawn('bunx', ['-y', AGENT_CLI, ...call.args], {
    stdio: 'inherit',
  })
  // A killed pass must not leave a browser running behind the parent, which a
  // shell `exec` never had between the caller and the child.
  const forward = (signal: NodeJS.Signals) => () => child.kill(signal)
  const handlers = FORWARDED_SIGNALS.map((signal) => {
    const handler = forward(signal)
    process.on(signal, handler)
    return [signal, handler] as const
  })

  try {
    return await new Promise<number>((resolve) => {
      child.on('error', (error) => {
        process.stderr.write(`canon browser: ${error.message}\n`)
        resolve(1)
      })
      child.on('exit', (code, signal) => {
        resolve(code ?? 128 + (signal ? constants.signals[signal] : 0))
      })
    })
  } finally {
    for (const [signal, handler] of handlers) process.off(signal, handler)
  }
}

function refuse(message: string): number {
  process.stderr.write(`canon browser: ${message}\n`)
  return 1
}
