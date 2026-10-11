import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

import { type StageContext, scenario } from '@/sandbox/scenario'

/**
 * Fakes a live session occupying `path`, so the cleanup arm can prove
 * occupancy holds a tree back independently of merge state. The registry this
 * writes to is the real one at CLAUDE_CONFIG_DIR (or $HOME/.claude/sessions):
 * provisioning and the later `claude -p` run are separate invocations with no
 * shared environment, so there is no sandbox-local registry to point at
 * instead. The spawned process bounds itself at six hours, comfortably past
 * any one drive and well under a day, so a record from an earlier drive dies
 * on its own and `canon sessions list` stops carrying it as live rather than
 * needing a teardown hook the harness does not have. The pid in the record's
 * filename is what keeps a second drive from overwriting the first run's
 * record and orphaning its still-running process.
 *
 * The occupant stays in the provisioning process group, unref'd rather than
 * detached, because equivalence reaps it by killing that group.
 */
function registerOccupant(ctx: StageContext, path: string): void {
  const worktreePath = resolve(ctx.dir, path)
  const configDir =
    (ctx.env.CLAUDE_CONFIG_DIR ?? '') !== ''
      ? (ctx.env.CLAUDE_CONFIG_DIR ?? '')
      : join(ctx.env.HOME ?? homedir(), '.claude')
  const sessionsDir = join(configDir, 'sessions')
  mkdirSync(sessionsDir, { recursive: true })

  const occupant = spawn('sleep', ['21600'], { stdio: 'ignore', env: ctx.env })
  occupant.unref()
  const occupantPid = occupant.pid
  if (occupantPid === undefined) ctx.fail('Could not start the fake occupant.')

  const recordFile = join(sessionsDir, `sandbox-occupant-${occupantPid}.json`)
  writeFileSync(
    recordFile,
    `{
  "pid": ${occupantPid},
  "cwd": "${worktreePath}",
  "name": "sandbox-occupant",
  "sessionId": "sandbox-occupant-${occupantPid}",
  "kind": "bg",
  "status": "idle",
  "startedAt": ${Date.now()}
}
`,
  )

  ctx.log.info(
    `Registered a fake occupant session at ${recordFile} (pid ${occupantPid}).`,
  )
  ctx.log.info(
    'Self-limiting: the process exits after six hours, and the dead record drops out of the live roster on its own.',
  )
}

/** Branches `name` off main with one file, back to main afterwards. */
function branchWithFile(
  ctx: StageContext,
  name: string,
  file: string,
  content: string,
  subject: string,
): void {
  ctx.git('checkout', '-b', `feat/${name}`, '-q')
  ctx.write(file, content)
  ctx.git('add', '.')
  ctx.commit(subject)
  ctx.git('checkout', 'main', '-q')
}

function mergeNoFf(ctx: StageContext, name: string): void {
  ctx.git(
    'merge',
    '--no-ff',
    `feat/${name}`,
    '-m',
    `merge feat/${name}`,
    '--no-verify',
    '-q',
  )
}

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
  },
  arms: {
    cleanup: (ctx) => {
      stageShared(ctx)

      branchWithFile(
        ctx,
        'alpha',
        'src/alpha.ts',
        'export const alpha = true;\n',
        'feat(alpha): add alpha',
      )
      mergeNoFf(ctx, 'alpha')

      branchWithFile(
        ctx,
        'beta',
        'src/beta.ts',
        'export const beta = false;\n',
        'feat(beta): add beta',
      )

      branchWithFile(
        ctx,
        'gamma',
        'src/gamma.ts',
        'export const gamma = true;\n',
        'feat(gamma): add gamma',
      )
      mergeNoFf(ctx, 'gamma')

      ctx.mkdir('.claude/worktrees')
      ctx.git('worktree', 'add', '.claude/worktrees/alpha', 'feat/alpha', '-q')
      ctx.git('worktree', 'add', '.claude/worktrees/beta', 'feat/beta', '-q')
      ctx.git('worktree', 'add', '.claude/worktrees/gamma', 'feat/gamma', '-q')
      registerOccupant(ctx, '.claude/worktrees/gamma')

      ctx.log.step(
        'Scenario ready: cleanup (offline merge detection via --no-ff)',
      )
      ctx.log.info(
        'Context: three linked worktrees. feat/alpha merged into main, feat/beta unmerged,',
      )
      ctx.log.info(
        '         feat/gamma merged and clean like alpha but occupied by a fake live session',
      )
      ctx.log.info('Action:  /git-worktree list, then /git-worktree cleanup')
      ctx.log.info(
        "Expect:  list shows alpha as 'merged (local)', beta as 'unmerged', gamma as 'occupied'",
      )
      ctx.log.info(
        '         cleanup removes .claude/worktrees/alpha/ and deletes feat/alpha, leaves beta and gamma alone',
      )
    },
    list: (ctx) => {
      stageShared(ctx)

      branchWithFile(
        ctx,
        'merged',
        'src/merged.ts',
        'export const merged = true;\n',
        'feat(merged): merged feature',
      )
      mergeNoFf(ctx, 'merged')

      branchWithFile(
        ctx,
        'dirty',
        'src/dirty.ts',
        'export const dirty = true;\n',
        'feat(dirty): committed part',
      )

      branchWithFile(
        ctx,
        'clean',
        'src/clean.ts',
        'export const clean = true;\n',
        'feat(clean): clean wip',
      )

      ctx.mkdir('.claude/worktrees')
      ctx.git(
        'worktree',
        'add',
        '.claude/worktrees/merged',
        'feat/merged',
        '-q',
      )
      ctx.git('worktree', 'add', '.claude/worktrees/dirty', 'feat/dirty', '-q')
      ctx.git('worktree', 'add', '.claude/worktrees/clean', 'feat/clean', '-q')

      ctx.write(
        '.claude/worktrees/dirty/src/extra.ts',
        'export const extra = true;\n',
      )

      ctx.log.step('Scenario ready: list (three-way state mix)')
      ctx.log.info(
        'Context: three linked worktrees: merged, dirty (uncommitted edit), clean unmerged',
      )
      ctx.log.info('Action:  /git-worktree list')
      ctx.log.info('Expect:  table with columns Path, Branch, State, PR, Notes')
      ctx.log.info(
        "         merged row shows 'merged (local)', dirty row shows Notes=dirty",
      )
      ctx.log.info("         clean row shows 'unmerged'")
    },
  },
})

function stageShared(ctx: StageContext): void {
  ctx.fixtures('claude', 'git-worktree', 'shared', '01-initial')

  ctx.mkdir('src')
  ctx.write('src/index.ts', 'export const name = "sandbox";\n')

  ctx.git('add', '.')
  ctx.commit('chore(sandbox): initial commit')
  ctx.git('branch', '-M', 'main')
}
