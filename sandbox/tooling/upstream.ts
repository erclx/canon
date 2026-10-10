import { readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { select } from '@/cli/ui'
import { type StageContext, scenario } from '@/sandbox/scenario'

interface UpstreamStack {
  readonly stack: string
  readonly command: string
}

/** What `grep '^scaffold' | cut -d'"' -f2` printed: the quoted value, or the whole line when none is quoted. */
function scaffoldOf(manifest: string): string {
  return readFileSync(manifest, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('scaffold'))
    .map((line) => (line.includes('"') ? (line.split('"')[1] ?? '') : line))
    .join('\n')
}

function collectUpstreamStacks(ctx: StageContext): UpstreamStack[] {
  const found = ctx.read('find', [
    join(ctx.root, 'tooling'),
    '-name',
    'manifest.toml',
  ])
  const manifests = ctx
    .capture('sort', [], { input: found })
    .stdout.split('\n')
    .filter((line) => line !== '')

  return manifests
    .map((manifest) => ({
      stack: basename(dirname(manifest)),
      command: scaffoldOf(manifest),
    }))
    .filter(({ command }) => command !== '')
}

export default scenario({
  arms: {
    default: async (ctx) => {
      // Exported at stage time rather than declared in `config`, so provisioning
      // reads it from the context's env after the arm returns, as the shell it
      // replaced did, and the seed installs before it run without it.
      ctx.env.SANDBOX_SKIP_AUTO_COMMIT = 'true'

      const stacks = collectUpstreamStacks(ctx)
      if (stacks.length === 0)
        ctx.fail('No stacks with upstream commands found in tooling/')

      const selected = await select({
        message: 'Select stack:',
        options: stacks.map(({ stack }) => ({ value: stack, label: stack })),
        nonInteractiveDefault: true,
      })
      const command =
        stacks.find(({ stack }) => stack === selected)?.command ?? ''
      const resolved = command.replaceAll('{{name}}', 'sandbox-upstream')

      ctx.log.step(`Provisioning upstream: ${selected}`)
      ctx.log.info(`Command: ${resolved}`)
      ctx.log.bar()

      ctx.run('bash', ['-e', '-o', 'pipefail', '-c', resolved])

      ctx.log.step(`Scenario ready: ${selected} upstream template`)
      ctx.log.info(`Location: ${ctx.dir}/sandbox-upstream/`)
      ctx.log.info('Raw upstream template, no golden configs applied')
      ctx.log.info("Run 'canon sandbox clean' to wipe when done")
    },
  },
})
