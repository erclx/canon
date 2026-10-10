import { describe, expect, it } from 'vitest'
import {
  findDeployWorkflow,
  mintPreview,
  type PreviewRunner,
  readPreviewAlias,
  readPreviewHead,
  readServedPaths,
  type RunRow,
  servesChange,
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

function run(
  databaseId: number,
  status: string,
  conclusion = '',
  headSha = 'aaa',
  createdAt = `2026-10-02T00:00:${String(databaseId).padStart(2, '0')}Z`,
): RunRow {
  return { databaseId, status, conclusion, headSha, createdAt }
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
      filter: { kind: 'all' },
    })
  })

  it("should carry the picked workflow's push path filter", () => {
    const pick = findDeployWorkflow([
      workflow(
        '.github/workflows/deploy.yml',
        FENCED.replace(
          'on:\n',
          "on:\n  push:\n    branches: [main]\n    paths:\n      - 'web/**'\n",
        ).replace(
          '- run: echo "canon-preview-alias: $ALIAS_URL"',
          '- run: |\n          echo "canon-preview-alias: $ALIAS_URL"',
        ),
      ),
    ])

    expect(pick).toEqual({
      kind: 'found',
      path: '.github/workflows/deploy.yml',
      filter: { kind: 'paths', patterns: ['web/**'] },
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

describe('readServedPaths', () => {
  it('should read on.push.paths as the paths that serve a change', () => {
    const text =
      "on:\n  push:\n    paths:\n      - 'web/**'\n      - '!web/drafts/**'\n"

    expect(readServedPaths(text)).toEqual({
      kind: 'paths',
      patterns: ['web/**', '!web/drafts/**'],
    })
  })

  it('should read on.push.paths-ignore as the paths that never serve one', () => {
    const text = "on:\n  push:\n    paths-ignore:\n      - 'docs/**'\n"

    expect(readServedPaths(text)).toEqual({
      kind: 'paths-ignore',
      patterns: ['docs/**'],
    })
  })

  it('should serve every change when the push trigger carries no path filter', () => {
    const text = 'on:\n  push:\n    branches: [main]\n  workflow_dispatch:\n'

    expect(readServedPaths(text)).toEqual({ kind: 'all' })
  })

  it('should serve every change when the workflow carries no push trigger', () => {
    expect(readServedPaths('on:\n  workflow_dispatch:\n')).toEqual({
      kind: 'all',
    })
  })

  it('should serve every change when the workflow is not readable YAML', () => {
    expect(readServedPaths('on: [push\n  : :')).toEqual({ kind: 'all' })
  })
})

describe('servesChange', () => {
  it('should serve a change touching a path under a ** pattern', () => {
    const filter = { kind: 'paths', patterns: ['web/**'] } as const

    expect(servesChange(filter, ['web/src/page.ts'])).toBe(true)
  })

  it('should not serve a change whose path only shares the prefix', () => {
    const filter = { kind: 'paths', patterns: ['web/**'] } as const

    expect(servesChange(filter, ['webhooks/x.ts'])).toBe(false)
  })

  it('should let a later negation exclude a path an earlier pattern included', () => {
    const filter = {
      kind: 'paths',
      patterns: ['web/**', '!web/drafts/**'],
    } as const

    expect(servesChange(filter, ['web/drafts/a.md'])).toBe(false)
  })

  it('should let a later inclusion restore a path an earlier negation excluded', () => {
    const filter = {
      kind: 'paths',
      patterns: ['web/**', '!web/drafts/**', 'web/drafts/keep.md'],
    } as const

    expect(servesChange(filter, ['web/drafts/keep.md'])).toBe(true)
  })

  it('should serve a change with any path outside paths-ignore', () => {
    const filter = { kind: 'paths-ignore', patterns: ['docs/**'] } as const

    expect(servesChange(filter, ['docs/a.md', 'src/b.ts'])).toBe(true)
  })

  it('should not serve a change whose every path is ignored', () => {
    const filter = { kind: 'paths-ignore', patterns: ['docs/**'] } as const

    expect(servesChange(filter, ['docs/a.md'])).toBe(false)
  })

  it('should serve any change when the filter is all', () => {
    expect(servesChange({ kind: 'all' }, ['anything.ts'])).toBe(true)
  })

  it("should read a canvas-only change as unserved by this repository's site deploy", async () => {
    const text = await Bun.file('.github/workflows/deploy-site.yml').text()

    expect(
      servesChange(readServedPaths(text), [
        'src/canvas/shell/selection.ts',
        'src/canvas/shell/selection.test.ts',
        'assets/evidence/canvas/arrange/selected.png',
      ]),
    ).toBe(false)
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

describe('readPreviewHead', () => {
  const TIP = 'tip0000'

  async function read(rows: readonly RunRow[] | undefined) {
    const runner = fakeRunner({ before: rows })
    runner.listRuns = async () => rows
    return readPreviewHead(runner, {
      workflow: SETTINGS.workflow,
      branch: SETTINGS.branch,
      tip: TIP,
    })
  }

  it('should read fresh when the newest successful run built the tip', async () => {
    const result = await read([run(2, 'completed', 'success', TIP)])

    expect(result).toEqual({
      reason: 'fresh',
      built: TIP,
      tip: TIP,
      runId: 2,
    })
  })

  it('should read stale naming both shas when the newest success built an earlier head', async () => {
    const result = await read([run(2, 'completed', 'success', 'old1111')])

    expect(result).toEqual({
      reason: 'stale',
      built: 'old1111',
      tip: TIP,
      runId: 2,
    })
  })

  it('should read building when a run at the tip is still going beside an older success', async () => {
    const result = await read([
      run(3, 'in_progress', '', TIP),
      run(2, 'completed', 'success', 'old1111'),
    ])

    expect(result).toEqual({
      reason: 'building',
      built: 'old1111',
      tip: TIP,
      runId: 3,
    })
  })

  it('should read no-build when no run succeeded', async () => {
    const result = await read([run(2, 'completed', 'failure', TIP)])

    expect(result).toEqual({ reason: 'no-build', tip: TIP })
  })

  it('should read stale when a run at the tip failed beside an older success', async () => {
    const result = await read([
      run(3, 'completed', 'failure', TIP),
      run(2, 'completed', 'success', 'old1111'),
    ])

    expect(result.reason).toBe('stale')
  })

  it('should order runs by creation rather than list position', async () => {
    const result = await read([
      run(1, 'completed', 'success', 'old1111', '2026-10-02T09:00:00Z'),
      run(2, 'completed', 'success', TIP, '2026-10-02T10:00:00Z'),
      run(3, 'completed', 'success', 'old1111', '2026-10-02T08:00:00Z'),
    ])

    expect(result).toMatchObject({ reason: 'fresh', runId: 2 })
  })

  it('should follow the most recent deploy when it built an older sha than an earlier one', async () => {
    const result = await read([
      run(1, 'completed', 'success', TIP, '2026-10-02T08:00:00Z'),
      run(2, 'completed', 'success', 'old1111', '2026-10-02T10:00:00Z'),
    ])

    expect(result).toMatchObject({ reason: 'stale', runId: 2 })
  })

  it('should refuse as gh-failed when the listing is unreadable', async () => {
    const result = await read(undefined)

    expect(result.reason).toBe('gh-failed')
  })
})
