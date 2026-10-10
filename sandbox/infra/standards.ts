import { join } from 'node:path'
import { ScenarioStop, type StageContext, scenario } from '@/sandbox/scenario'

const JQ_PARSE_ERROR = 5

function cli(ctx: StageContext, ...args: string[]): string[] {
  return [join(ctx.root, 'src', 'cli.ts'), ...args]
}

/** What `jq '.standards[0] | keys'` printed: the first record's keys, sorted, one per line. */
function firstRecordKeys(json: string): string {
  try {
    const parsed = JSON.parse(json) as { standards: Record<string, unknown>[] }

    return `${JSON.stringify(Object.keys(parsed.standards[0] ?? {}).sort(), null, 2)}\n`
  } catch {
    throw new ScenarioStop(JQ_PARSE_ERROR, 'exited')
  }
}

export default scenario({
  config: { SANDBOX_SKIP_AUTO_COMMIT: 'true' },
  prepare: (ctx) => {
    ctx.mkdir('install')
    ctx.write('install/.gitkeep', '')

    // A standard this project authored at its own root. Nothing installs the
    // toolkit corpus into a target any more, so the root folder is the only
    // project spelling left and the arm below reads past it to the package copy.
    ctx.write(
      'authored/standards/project-own.md',
      '---\ntitle: Project own\ndescription: A standard this project authored\n---\n\n# Project own\n',
    )

    ctx.git('add', '.')
    ctx.commit('chore(sandbox): scaffold standards test directories')

    ctx.log.step('Standards sandbox')
    ctx.log.info('list     : read-only catalog dump, no target needed')
    ctx.log.info(
      'read     : resolves one standard from install/, where the project',
    )
    ctx.log.info(
      '           spelling does not exist, so only the package corpus can answer',
    )
    ctx.log.info(
      'authored/: a project-authored standard at the root the resolver reads first',
    )
  },
  arms: {
    list: (ctx) => {
      ctx.log.step('Running: canon standards list')
      ctx.run('bun', cli(ctx, 'standards', 'list'))
      ctx.log.step(
        "Running: canon standards list --json | jq '.standards[0] | keys'",
      )
      ctx.print(
        firstRecordKeys(
          ctx.read('bun', cli(ctx, 'standards', 'list', '--json')),
        ),
      )
      ctx.log.info('Expect keys: appliesTo, content, description, name, source')
    },
    read: (ctx) => {
      // Run from `install/` rather than from the sandbox root. The root carries
      // `authored/standards/`, and a reader checking the premise by eye would have
      // to know the resolve never walks upward to tell the two apart.
      //
      // Both streams land on disk because `canon sandbox check` reads the tree and
      // nothing else. The frame carries the root that answered and the body carries
      // the document, so splitting them is what lets the arm assert the resolve
      // separately from the read.
      // The status is held rather than left to stop the arm. A miss writes its
      // warning and the whole catalog to the log file, so an abort here would kill
      // the scenario with the one diagnostic the command produced sitting unread.
      ctx.log.step(
        'Running: canon standards skill (from install/, which holds none)',
      )
      const result = ctx.capture('bun', cli(ctx, 'standards', 'skill'), {
        cwd: 'install',
      })
      ctx.write('install/read-body.md', result.stdout)
      ctx.write('install/read-frame.log', result.stderr)
      ctx.print(result.stderr, 'stderr')
      if (result.status !== 0)
        ctx.fail(`The read exited ${result.status}. The frame above says why.`)
      ctx.log.info('install/read-frame.log names the root that answered')
      ctx.log.info('install/read-body.md  is the document that root returned')
      ctx.log.info(
        'Expect: declared in fixtures/infra/standards/read/expect.toml',
      )
      ctx.log.info(
        '        Check it with: canon sandbox check infra:standards read',
      )
    },
  },
})
