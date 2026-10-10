import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: { SANDBOX_SKIP_AUTO_COMMIT: 'true' },
  prepare: (ctx) => {
    ctx.mkdir('install')
    ctx.write('install/.gitkeep', '')

    ctx.git('add', '.')
    ctx.commit('chore(sandbox): scaffold feedback test directory')

    ctx.log.step('Feedback sandbox')
    ctx.log.info(
      'refusal: pipes a report missing its Proposed fix section and asserts',
    )
    ctx.log.info('         the command names that field and writes nothing')
  },
  arms: {
    refusal: (ctx) => {
      // The one arm this command can assert. A report that passes validation
      // writes into the toolkit's own `.canon/feedback/`, which sits outside the
      // tree the snapshot covers, and `run.sh` reports that as an escape. A
      // refusal writes nowhere at all, so the whole behavior lands inside the
      // sandbox.
      //
      // Both streams go to disk because `canon sandbox check` reads the tree and
      // nothing else. The status is held rather than left to stop the arm, since
      // a refusal exits 1 by design and an abort here would kill the scenario on
      // the outcome it exists to record.
      ctx.log.step(
        'Running: canon feedback (report missing its Proposed fix section)',
      )
      const report = readFileSync(
        join(
          ctx.root,
          'sandbox',
          'fixtures',
          'infra',
          'feedback',
          'refusal',
          'stdin',
          'report.md.fixture',
        ),
        'utf8',
      )
      const result = ctx.capture(
        'bun',
        [join(ctx.root, 'src', 'cli.ts'), 'feedback'],
        { cwd: 'install', input: report },
      )
      ctx.write('install/refusal-stdout.log', result.stdout)
      ctx.write('install/refusal.log', result.stderr)
      ctx.write('install/refusal-status.txt', `${result.status}\n`)
      // Byte count rather than the stream, because an assertion cannot pattern
      // match an empty file and a refusal that printed a path is the failure
      // this arm is watching for.
      ctx.write(
        'install/refusal-stdout-bytes.txt',
        `${Buffer.byteLength(result.stdout)}\n`,
      )
      ctx.print(result.stderr, 'stderr')
      ctx.log.info('install/refusal.log        carries the refusal and the field it named')
      ctx.log.info('install/refusal-status.txt carries the exit status')
      ctx.log.info('Expect: declared in fixtures/infra/feedback/refusal/expect.toml')
      ctx.log.info('        Check it with: canon sandbox check infra:feedback refusal')
    },
  },
})
