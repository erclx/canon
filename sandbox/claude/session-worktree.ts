import { type StageContext, scenario } from '@/sandbox/scenario'

/** Closes every arm: the blank frame line and the cleanup hint. */
function logCleanup(ctx: StageContext): void {
  ctx.log.info('')
  ctx.log.info(
    "Cleanup: run 'canon sandbox clean' after the test to wipe the worktree and its branch refs.",
  )
}

/**
 * Both submodule arms stage one tree and differ only in where the session is
 * told to run. The expectation format carries no prompt field, so each arm's
 * `expect.toml` names the prompt it was written against and the two would
 * silently swap verdicts if a caller crossed them.
 */
function stageSubmodule(ctx: StageContext): void {
  ctx.fixtures('claude', 'session-worktree', 'shared', '01-plan')

  // The origin the submodule is added from stays on disk for later fetches
  // and is ignored, since an untracked nested repository inside the fixture
  // shows up in every status read and enters the index as a gitlink on the
  // next git add.
  ctx.append('.gitignore', '.sandbox-submodule-origin/\n')

  ctx.git('add', '.')
  ctx.commit('feat(plans): seed grault plan')
  ctx.git('checkout', '-b', 'grault', '-q')

  // An absorbed submodule returns one identical path from --git-dir and
  // --git-common-dir, so the linked-worktree guard passes here and the
  // superproject read is the only one that separates the two states.
  ctx.git('init', '-q', '.sandbox-submodule-origin')
  ctx.git(
    '-C',
    '.sandbox-submodule-origin',
    'config',
    'user.email',
    'sandbox@example.com',
  )
  ctx.git('-C', '.sandbox-submodule-origin', 'config', 'user.name', 'Sandbox')
  ctx.write('.sandbox-submodule-origin/lib.js', 'export const VALUE = 1;\n')
  ctx.git('-C', '.sandbox-submodule-origin', 'add', '-A')
  ctx.git(
    '-C',
    '.sandbox-submodule-origin',
    'commit',
    '-m',
    'chore(lib): init',
    '-q',
  )

  ctx.git(
    '-c',
    'protocol.file.allow=always',
    'submodule',
    'add',
    '-q',
    './.sandbox-submodule-origin',
    'vendor',
  )
  ctx.commit('chore(vendor): add submodule')
}

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  prepare: (ctx) => {
    ctx.log.info(
      'matched-plan : branch foo + matching plan, skill picks foo without prompting',
    )
    ctx.log.info(
      'multi-plan   : default branch + two plans, skill falls to tier 3 and asks which plan',
    )
    ctx.log.info('branch-only  : branch bar + no plans, skill uses bar')
    ctx.log.info(
      'typed-branch : branch feat/baz + matching plan, target collides and the skill stops before entry',
    )
    ctx.log.info(
      'no-deps      : branch qux + matching plan + a manifest with nothing installed, skill reports the install command',
    )
    ctx.log.info(
      'dual-root    : branch quux + matching plan + both a node and a python manifest, skill reports both independently',
    )
    ctx.log.info(
      'port-offset  : branch corge + matching plan + the port helper installed, skill reports a derived offset',
    )
    ctx.log.info(
      'submodule    : run from inside the submodule, skill stops and names the superproject',
    )
    ctx.log.info(
      'submodule-root: the same tree run from the superproject root, skill proceeds',
    )
  },
  arms: {
    'matched-plan': (ctx) => {
      ctx.mkdir('.canon/plans')

      ctx.fixtures('claude', 'session-worktree', 'matched-plan', '01-plan')
      ctx.git('checkout', '-b', 'foo', '-q')

      ctx.log.step('Scenario ready: matched-plan tier (Step 2, tier 1)')
      ctx.log.info('Branch: foo')
      ctx.log.info('Plan:   .canon/plans/feature-foo.md')
      ctx.log.info('Action:  /canon:session-worktree')
      ctx.log.info('Expect:  skill derives foo from tier 1, no prompt')
      ctx.log.info(
        '         worktree at .claude/worktrees/foo/, branch feat/foo post-rename',
      )
      logCleanup(ctx)
    },
    'multi-plan': (ctx) => {
      ctx.mkdir('.canon/plans')

      ctx.fixtures('claude', 'session-worktree', 'multi-plan', '01-plan')

      ctx.log.step('Scenario ready: multi-plan tier (Step 2, tier 3)')
      ctx.log.info('Branch: default')
      ctx.log.info('Plans:  feature-alpha.md, feature-bravo.md')
      ctx.log.info('Action:  /canon:session-worktree')
      ctx.log.info('Expect:  skill falls to tier 3 and asks which plan')
      ctx.log.info('         respond with alpha or bravo to pick the slug')
      logCleanup(ctx)
    },
    'branch-only': (ctx) => {
      ctx.mkdir('.canon/plans')

      ctx.git('checkout', '-b', 'bar', '-q')

      ctx.log.step('Scenario ready: branch-only tier (Step 2, tier 4)')
      ctx.log.info('Branch: bar')
      ctx.log.info('Plans:  none')
      ctx.log.info('Action:  /canon:session-worktree')
      ctx.log.info('Expect:  skill falls to tier 4 and uses bar')
      ctx.log.info(
        '         worktree at .claude/worktrees/bar/, branch feat/bar post-rename',
      )
      logCleanup(ctx)
    },
    'typed-branch': (ctx) => {
      ctx.mkdir('.canon/plans')

      ctx.fixtures('claude', 'session-worktree', 'typed-branch', '01-plan')
      ctx.git('checkout', '-b', 'feat/baz', '-q')

      ctx.log.step('Scenario ready: target collision (Step 2)')
      ctx.log.info('Branch: feat/baz')
      ctx.log.info('Plan:   .canon/plans/feature-baz.md')
      ctx.log.info('Action:  /canon:session-worktree')
      ctx.log.info(
        'Expect:  slug transform drops the type, so tier 1 derives baz',
      )
      ctx.log.info('         target feat/baz already exists, so Step 2 stops')
      ctx.log.info(
        '         no worktree is created and the existing branch is left alone',
      )
      logCleanup(ctx)
    },
    'no-deps': (ctx) => {
      ctx.mkdir('.canon/plans')

      ctx.fixtures('claude', 'session-worktree', 'no-deps', '01-plan')

      ctx.git('add', '.')
      ctx.commit('feat(plans): seed qux plan and manifest')
      ctx.git('checkout', '-b', 'qux', '-q')

      ctx.log.step('Scenario ready: dependency report (Step 6)')
      ctx.log.info('Branch: qux')
      ctx.log.info('Plan:   .canon/plans/feature-qux.md')
      ctx.log.info('Action:  /canon:session-worktree')
      ctx.log.info('Expect:  entry proceeds, then Step 6 reports two lines')
      ctx.log.info(
        '         package.json present and node_modules missing, so it names bun install',
      )
      ctx.log.info(
        '         no scripts/worktree-port.sh here, so the port line names the stack default',
      )
      ctx.log.info(
        '         nothing is installed, since the step reports rather than runs',
      )
      logCleanup(ctx)
    },
    'dual-root': (ctx) => {
      ctx.mkdir('.canon/plans')

      ctx.fixtures('claude', 'session-worktree', 'dual-root', '01-plan')

      ctx.git('add', '.')
      ctx.commit('feat(plans): seed quux plan and both manifests')
      ctx.git('checkout', '-b', 'quux', '-q')

      ctx.log.step('Scenario ready: dual-root dependency report (Step 6)')
      ctx.log.info('Branch: quux')
      ctx.log.info('Plan:   .canon/plans/feature-quux.md')
      ctx.log.info('Action:  /canon:session-worktree')
      ctx.log.info(
        'Expect:  entry proceeds, then Step 6 reports both ecosystems',
      )
      ctx.log.info(
        '         package.json present and node_modules missing, so it names bun install',
      )
      ctx.log.info(
        '         pyproject.toml present and .venv missing, so it names the missing virtual environment',
      )
      ctx.log.info(
        '         no scripts/worktree-port.sh here, so the port line names the stack default',
      )
      ctx.log.info(
        'Headless: sandbox/run.sh claude:session-worktree "/canon:session-worktree" dual-root',
      )
      logCleanup(ctx)
    },
    'port-offset': (ctx) => {
      ctx.mkdir('.canon/plans')

      ctx.fixtures('claude', 'session-worktree', 'port-offset', '01-plan')

      ctx.mkdir('scripts')
      ctx.run('cp', [
        `${ctx.root}/tooling/web/configs/scripts/worktree-port.sh`,
        'scripts/worktree-port.sh',
      ])
      ctx.run('chmod', ['+x', 'scripts/worktree-port.sh'])
      ctx.append('.gitignore', '.claude/worktrees/\n')

      ctx.git('add', '.')
      ctx.commit('feat(scripts): seed corge plan and the port helper')
      ctx.git('checkout', '-b', 'corge', '-q')

      // A folder left behind after its worktree was removed, which is the state
      // the helper refuses. It is a sibling rather than the entry target, since
      // Step 4 registers whatever it creates and a fresh entry never lands on one.
      ctx.fixtures('claude', 'session-worktree', 'port-offset', '02-stale')

      ctx.log.step('Scenario ready: port report (Step 6)')
      ctx.log.info('Branch: corge')
      ctx.log.info('Plan:   .canon/plans/feature-corge.md')
      ctx.log.info('Action:  /canon:session-worktree')
      ctx.log.info(
        'Expect:  declared in fixtures/claude/session-worktree/port-offset/expect.toml',
      )
      logCleanup(ctx)
    },
    submodule: (ctx) => {
      ctx.mkdir('.canon/plans')

      stageSubmodule(ctx)

      ctx.log.step('Scenario ready: submodule guard (Guards)')
      ctx.log.info('Branch: grault')
      ctx.log.info(
        'Plan:   .canon/plans/feature-grault.md at the superproject root',
      )
      ctx.log.info('Action:  cd vendor, then /canon:session-worktree')
      ctx.log.info(
        'Expect:  both rev-parse reads return one path, so the linked-worktree guard passes',
      )
      ctx.log.info(
        '         the superproject read resolves, so the skill stops and names this root',
      )
      ctx.log.info(
        '         no worktree is created and no .claude/ is written under vendor',
      )
      ctx.log.info(
        'Headless: sandbox/run.sh claude:session-worktree "cd vendor, then /canon:session-worktree" submodule',
      )
      logCleanup(ctx)
    },
    'submodule-root': (ctx) => {
      ctx.mkdir('.canon/plans')

      stageSubmodule(ctx)

      ctx.log.step('Scenario ready: submodule control (Guards)')
      ctx.log.info('Branch: grault')
      ctx.log.info(
        'Plan:   .canon/plans/feature-grault.md at the superproject root',
      )
      ctx.log.info('Action:  /canon:session-worktree from this root')
      ctx.log.info(
        'Expect:  the superproject read is empty here, so the guard stays silent',
      )
      ctx.log.info(
        '         entry derives grault from the plan and creates the worktree',
      )
      ctx.log.info(
        'Headless: sandbox/run.sh claude:session-worktree "/canon:session-worktree" submodule-root',
      )
      logCleanup(ctx)
    },
  },
})
