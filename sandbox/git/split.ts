import { type StageContext, scenario } from '@/sandbox/scenario'

function configure(ctx: StageContext): void {
  ctx.log.step(`Configuring split environment (${ctx.env.ANCHOR_REPO})`)
  ctx.anchorRemote()
  ctx.git('push', '--force', 'origin', 'HEAD:main')
}

function startBranch(ctx: StageContext, branch: string): void {
  ctx.run('git', ['push', 'origin', '--delete', branch, '-q'], {
    stderr: 'ignore',
    allowFailure: true,
  })
  ctx.git('checkout', '-b', branch, '-q')
}

function commitAll(ctx: StageContext, subject: string): void {
  ctx.git('add', '.')
  ctx.commit(subject)
}

export default scenario({
  config: { SANDBOX_SKIP_AUTO_COMMIT: 'true' },
  anchor: true,
  arms: {
    independent: (ctx) => {
      configure(ctx)
      startBranch(ctx, 'feat/user-auth')

      ctx.write(
        'src/auth.js',
        'export function login(user) { return fetch("/api/login", { body: user }); }\n',
      )
      commitAll(ctx, 'feat(auth): add login function')

      ctx.append(
        'src/auth.js',
        'export function logout() { return fetch("/api/logout"); }\n',
      )
      commitAll(ctx, 'feat(auth): add logout function')

      ctx.fixtures('git', 'split', 'independent', '03-setup-script')
      commitAll(ctx, 'chore(scripts): add project setup script')

      ctx.write('docs/auth.md', '# Auth module\n\nHandles login and logout.\n')
      commitAll(ctx, 'docs(auth): add auth module reference')

      ctx.write(
        'docs/contributing.md',
        '# Contributing\n\nRun npm install before committing.\n',
      )
      commitAll(ctx, 'docs(project): add contributing guide')

      ctx.append(
        'src/auth.js',
        'export function register(user) { return fetch("/api/register", { body: user }); }\n',
      )
      commitAll(ctx, 'feat(auth): add register function')

      ctx.log.step(
        'Scenario ready: 6 mixed independent commits on feat/user-auth',
      )
      ctx.log.info(
        'Context: 3 auth + 1 chore/scripts + 2 docs (no file overlap between groups)',
      )
      ctx.log.info('Action:  /canon:git-split')
      ctx.log.info(
        'Expect:  Independent mode. One branch per concern. PRs based on main',
      )
    },
    stacked: (ctx) => {
      configure(ctx)
      startBranch(ctx, 'feat/payments')

      ctx.write(
        'src/logger.js',
        'export function logger(msg) { console.log(msg); }\n',
      )
      commitAll(ctx, 'feat(logger): add logger helper')

      ctx.write(
        'src/payments.js',
        'export function charge(amount) { return fetch("/api/charge"); }\n',
      )
      commitAll(ctx, 'feat(payments): add charge function')

      ctx.fixtures('git', 'split', 'stacked', '03-use-logger')
      commitAll(ctx, 'refactor(payments): use logger')

      ctx.log.step('Scenario ready: 3 stacked commits on feat/payments')
      ctx.log.info(
        'Context: logger -> payments -> refactor-using-logger (refactor depends on both prior groups)',
      )
      ctx.log.info('Action:  /canon:git-split')
      ctx.log.info(
        'Expect:  Stacked mode. 3 stacked branches/PRs. Merge-loop instructions in response',
      )
    },
  },
})
