import { spawnSync } from 'node:child_process'
import { chmodSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { shellQuote } from '@/sandbox/headless/dispatch'

/**
 * Writes a `canon` that runs this checkout's CLI, placed first on every PATH a
 * run spawns, since a bare `canon` would resolve to the release that refuses a
 * verb the branch adds. Both paths are baked in quoted so a linked worktree reaches its own source.
 */
export function installCanonShim(dir: string, bun: string, cli: string): void {
  const wrapper = [
    '#!/usr/bin/env bash',
    `exec ${shellQuote(bun)} ${shellQuote(cli)} "$@"`,
    '',
  ].join('\n')

  writeFileSync(join(dir, 'canon'), wrapper, 'utf8')
  chmodSync(join(dir, 'canon'), 0o755)
}

/**
 * Which CLI a run drove, named by source path and commit, since the branch and
 * the release print one version until a release cuts. `head` is null rather
 * than a throw when git cannot read the checkout.
 */
export interface BranchCli {
  readonly cli: string
  readonly head: string | null
}

export function describeBranchCli(projectRoot: string): BranchCli {
  const rev = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: projectRoot,
    encoding: 'utf8',
  })
  const head = rev.status === 0 ? (rev.stdout ?? '').trim() : ''

  return {
    cli: join(projectRoot, 'src/cli.ts'),
    head: head === '' ? null : head,
  }
}
