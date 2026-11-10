import { spawnSync } from 'node:child_process'
import { chmodSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { shellQuote } from '@/sandbox/headless/dispatch'

/**
 * Writes a `canon` that runs this checkout's CLI, for the runner to place first
 * on every PATH a run spawns. Without it a bare `canon` in provisioning or in
 * the session resolves to the published release, which refuses a verb the
 * branch adds.
 *
 * Both paths are baked in quoted rather than looked up, so the run's own Bun
 * drives the child whatever `bun` the session's PATH would find, and a run from
 * a linked worktree reaches that worktree's source rather than the main one.
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
 * Which CLI a run drove. The version string cannot answer this, since the
 * branch and the release print the same one until a release cuts, so the
 * record names the source path and the commit it sat at.
 *
 * `head` is null rather than a throw when git cannot read the checkout, since
 * a missing commit is a gap in the record, not a reason to refuse the run.
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
