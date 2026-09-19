import { describe, expect, it } from 'vitest'
import {
  findDeployWorkflow,
  mintPreview,
  type PreviewRunner,
  readPreviewAlias,
  type RunRow,
  type WorkflowFile,
} from '@/pr/preview'

const FENCED = [
  'on:',
  '  workflow_dispatch:',
  'jobs:',
  '  deploy:',
  '    steps:',
  '      - uses: cloudflare/wrangler-action@v3',
  '        with:',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a workflow expression, not a template
  '          command: pages deploy dist --project-name=site --branch=${{ github.ref_name }}',
  '      - run: echo "canon-preview-alias: $ALIAS_URL"',
].join('\n')

function workflow(path: string, text: string): WorkflowFile {
  return { path, text }
}

function run(databaseId: number, status: string, conclusion = ''): RunRow {
  return { databaseId, status, conclusion }
}

interface FakeRunnerOptions {
  readonly before?: readonly RunRow[]
  readonly after?: readonly RunRow[]
  readonly views?: readonly (RunRow | undefined)[]
  readonly log?: string
  readonly dispatched?: boolean
}

function fakeRunner(options: FakeRunnerOptions): PreviewRunner & {
  readonly dispatches: string[]
} {
  let clock = 0
  let listed = 0
  let viewed = 0
  const dispatches: string[] = []
  return {
    dispatches,
    async dispatch(path, ref) {
      dispatches.push(`${path}@${ref}`)
      return options.dispatched ?? true
    },
    async listRuns() {
      listed += 1
      return listed === 1 ? (options.before ?? []) : (options.after ?? [])
    },
    async viewRun() {
      const row = options.views?.[Math.min(viewed, options.views.length - 1)]
      viewed += 1
      return row
    },
    async readLog() {
      return options.log
    },
    now: () => clock,
    async sleep(ms) {
      clock += ms
    },
  }
}

const SETTINGS = {
  workflow: '.github/workflows/deploy.yml',
  branch: 'feat/thing',
  timeoutMs: 60_000,
  pollMs: 10_000,
}

describe('findDeployWorkflow', () => {
  it('should find a dispatchable workflow whose pages deploy carries the branch fence', () => {
    const pick = findDeployWorkflow([
      workflow('.github/workflows/ci.yml', 'on:\n  push:\n'),
      workflow('.github/workflows/deploy.yml', FENCED),
    ])

    expect(pick).toEqual({
      kind: 'found',
      path: '.github/workflows/deploy.yml',
    })
  })

  it('should refuse as no-deploy when no workflow runs pages deploy', () => {
    const pick = findDeployWorkflow([
      workflow('.github/workflows/ci.yml', 'on:\n  workflow_dispatch:\n'),
    ])

    expect(pick).toEqual({ kind: 'refused', reason: 'no-deploy' })
  })

  it('should refuse as no-deploy when the deploy workflow carries no dispatch trigger', () => {
    const pick = findDeployWorkflow([
      workflow(
        '.github/workflows/deploy.yml',
        FENCED.replace('  workflow_dispatch:', '  push:'),
      ),
    ])

    expect(pick).toEqual({ kind: 'refused', reason: 'no-deploy' })
  })

  it('should refuse as unfenced when the dispatchable deploy passes no branch', () => {
    const pick = findDeployWorkflow([
      workflow(
        '.github/workflows/deploy.yml',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: a workflow expression, not a template
        FENCED.replace(' --branch=${{ github.ref_name }}', ''),
      ),
    ])

    expect(pick).toEqual({ kind: 'refused', reason: 'unfenced' })
  })

  it('should refuse as unfenced when the fence appears only in a comment', () => {
    const pick = findDeployWorkflow([
      workflow(
        '.github/workflows/deploy.yml',
        FENCED.replace(
          // biome-ignore lint/suspicious/noTemplateCurlyInString: a workflow expression, not a template
          ' --branch=${{ github.ref_name }}',
          // biome-ignore lint/suspicious/noTemplateCurlyInString: a workflow expression, not a template
          '\n          # pass --branch=${{ github.ref_name }} here',
        ),
      ),
    ])

    expect(pick).toEqual({ kind: 'refused', reason: 'unfenced' })
  })

  it('should refuse as unfenced when one of two deploy commands passes no branch', () => {
    const pick = findDeployWorkflow([
      workflow(
        '.github/workflows/deploy.yml',
        `${FENCED}\n      - run: wrangler pages deploy other --project-name=site`,
      ),
    ])

    expect(pick).toEqual({ kind: 'refused', reason: 'unfenced' })
  })

  it('should refuse as no-alias when the marker appears only in a comment', () => {
    const pick = findDeployWorkflow([
      workflow(
        '.github/workflows/deploy.yml',
        FENCED.replace(
          '      - run: echo "canon-preview-alias: $ALIAS_URL"',
          '      # prints canon-preview-alias: <url>',
        ),
      ),
    ])

    expect(pick).toEqual({ kind: 'refused', reason: 'no-alias' })
  })

  it('should refuse as no-alias when the fenced deploy prints no alias marker', () => {
    const pick = findDeployWorkflow([
      workflow(
        '.github/workflows/deploy.yml',
        FENCED.replace('canon-preview-alias', 'something-else'),
      ),
    ])

    expect(pick).toEqual({ kind: 'refused', reason: 'no-alias' })
  })
})

describe('readPreviewAlias', () => {
  it('should read the address off a timestamped job log line', () => {
    const log = [
      'Deploy\tReport preview alias\t2026-09-19T10:00:00.0000000Z canon-preview-alias: https://feat-thing.site.pages.dev',
    ].join('\n')

    expect(readPreviewAlias(log)).toBe('https://feat-thing.site.pages.dev')
  })

  it('should ignore the unexpanded script line GitHub echoes above the step', () => {
    const log =
      'Deploy\tReport preview alias\t2026-09-19T10:00:00Z echo "canon-preview-alias: $ALIAS_URL"'

    expect(readPreviewAlias(log)).toBeUndefined()
  })
})

describe('mintPreview', () => {
  it('should return the alias the new run printed', async () => {
    const runner = fakeRunner({
      before: [run(1, 'completed', 'success')],
      after: [run(2, 'queued'), run(1, 'completed', 'success')],
      views: [run(2, 'in_progress'), run(2, 'completed', 'success')],
      log: 'x\ty\tcanon-preview-alias: https://feat-thing.site.pages.dev',
    })

    const result = await mintPreview(runner, SETTINGS)

    expect(result).toEqual({
      kind: 'minted',
      runId: 2,
      url: 'https://feat-thing.site.pages.dev',
    })
  })

  it('should dispatch the workflow on the pull request branch', async () => {
    const runner = fakeRunner({
      after: [run(2, 'completed', 'success')],
      views: [run(2, 'completed', 'success')],
      log: 'canon-preview-alias: https://a.site.pages.dev',
    })

    await mintPreview(runner, SETTINGS)

    expect(runner.dispatches).toEqual([
      '.github/workflows/deploy.yml@feat/thing',
    ])
  })

  it('should refuse as run-failed when the run concludes anything but success', async () => {
    const runner = fakeRunner({
      after: [run(2, 'queued')],
      views: [run(2, 'completed', 'failure')],
    })

    const result = await mintPreview(runner, SETTINGS)

    expect(result).toEqual({ kind: 'refused', reason: 'run-failed', runId: 2 })
  })

  it('should refuse as timeout when the run is still going at the bound', async () => {
    const runner = fakeRunner({
      after: [run(2, 'in_progress')],
      views: [run(2, 'in_progress')],
    })

    const result = await mintPreview(runner, SETTINGS)

    expect(result).toEqual({ kind: 'refused', reason: 'timeout', runId: 2 })
  })

  it('should refuse as timeout when the dispatched run never appears', async () => {
    const runner = fakeRunner({
      before: [run(1, 'completed', 'success')],
      after: [run(1, 'completed', 'success')],
    })

    const result = await mintPreview(runner, SETTINGS)

    expect(result).toEqual({ kind: 'refused', reason: 'timeout' })
  })

  it('should refuse as no-alias when the successful run printed no marker', async () => {
    const runner = fakeRunner({
      after: [run(2, 'completed', 'success')],
      views: [run(2, 'completed', 'success')],
      log: 'nothing here',
    })

    const result = await mintPreview(runner, SETTINGS)

    expect(result).toEqual({ kind: 'refused', reason: 'no-alias', runId: 2 })
  })

  it('should refuse as gh-failed when the dispatch itself fails', async () => {
    const runner = fakeRunner({ dispatched: false })

    const result = await mintPreview(runner, SETTINGS)

    expect(result).toEqual({ kind: 'refused', reason: 'gh-failed' })
  })
})
