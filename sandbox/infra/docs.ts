import { join } from 'node:path'
import { ScenarioStop, type StageContext, scenario } from '@/sandbox/scenario'

const JQ_PARSE_ERROR = 5

function cli(ctx: StageContext, ...args: string[]): string {
  return ctx.read('bun', [join(ctx.root, 'src', 'cli.ts'), ...args])
}

/** What `jq '.docs[0] | keys'` printed: the first record's keys, sorted, one per line. */
function firstRecordKeys(json: string, collection: string): string {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>
    const records = parsed[collection] as Record<string, unknown>[]
    const first = records[0] ?? {}

    return `${JSON.stringify(Object.keys(first).sort(), null, 2)}\n`
  } catch {
    throw new ScenarioStop(JQ_PARSE_ERROR, 'exited')
  }
}

/** What `head -5 <<<"$doc"` printed, the command substitution having dropped trailing newlines. */
function head(text: string, count: number): string {
  return `${text.replace(/\n+$/, '').split('\n').slice(0, count).join('\n')}\n`
}

export default scenario({
  config: { SANDBOX_SKIP_AUTO_COMMIT: 'true' },
  prepare: (ctx) => {
    ctx.log.step('Docs sandbox')
    ctx.log.info(
      'list : downstream catalog, toolkit-internal context entries filtered out',
    )
    ctx.log.info(
      'get  : print one doc to stdout by exact name, from docs/ or canon/context/',
    )
    ctx.log.info(
      "canon docs reads the toolkit's own docs/ and canon/context/, no target needed",
    )
  },
  arms: {
    list: (ctx) => {
      const run = (...args: string[]): number =>
        ctx.run('bun', [join(ctx.root, 'src', 'cli.ts'), ...args])

      ctx.log.step('Running: canon docs list')
      run('docs', 'list')
      ctx.log.step("Running: canon docs list --json | jq '.docs[0] | keys'")
      ctx.print(firstRecordKeys(cli(ctx, 'docs', 'list', '--json'), 'docs'))
      ctx.log.info('Expect keys: category, description, name, target')
      ctx.log.info('Expect docs topics: agents, ai-workflow, projects')
      ctx.log.info(
        'Expect ai-workflow at target docs/workflow/ai-workflow.md, listed from one level down',
      )
      ctx.log.info(
        'Expect projects at target docs/target/projects.md, listed from one level down',
      )
      ctx.log.info(
        'Expect no workflow topic: the folder index declares no target-facing category',
      )
      ctx.log.info(
        'Expect agents by folder name, described by its index subtitle',
      )
      ctx.log.info(
        'Expect domain context topics: tooling, governance, standards',
      )
      ctx.log.info(
        'Expect no toolkit-internal topics: ci, development, sandbox',
      )
    },
    get: (ctx) => {
      ctx.log.step('Running: canon docs agents')
      ctx.print(head(cli(ctx, 'docs', 'agents'), 5))
      ctx.log.info(
        'Expect the agents folder index on stdout, frontmatter stripped',
      )
      ctx.log.step('Running: canon docs tooling')
      ctx.print(head(cli(ctx, 'docs', 'tooling'), 5))
      ctx.log.info(
        'Expect the tooling doc resolved from canon/context/, not docs/',
      )
    },
  },
})
