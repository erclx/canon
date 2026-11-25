import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

interface WorkflowStep {
  name?: string
  id?: string
  if?: string
  run?: string
  env?: Record<string, string>
  with?: { key?: string; name?: string }
}

interface WorkflowJob {
  name?: string
  if?: string
  needs?: string | string[]
  strategy?: {
    'fail-fast'?: boolean
    matrix?: { shardIndex?: number[]; shardTotal?: number[] }
  }
  steps: WorkflowStep[]
}

const WORKFLOW_PATH = join(
  import.meta.dirname,
  '../../tooling/web/configs/.github/workflows/verify.yml',
)

const GATE = "steps.browser.outputs.enabled == 'true'"

const readJobs = (): Record<string, WorkflowJob> => {
  const parsed = Bun.YAML.parse(readFileSync(WORKFLOW_PATH, 'utf8')) as {
    jobs: Record<string, WorkflowJob>
  }
  return parsed.jobs
}

const unitSteps = (): WorkflowStep[] => readJobs()['unit-tests'].steps

const stepNamed = (steps: WorkflowStep[], name: string): WorkflowStep => {
  const step = steps.find((candidate) => candidate.name === name)
  if (!step) throw new Error(`no step named ${name}`)
  return step
}

describe('web verify.yml unit-tests job', () => {
  const browserSteps = [
    'Cache Playwright Browsers',
    'Install Playwright Chromium',
    'Run Browser Tests',
  ]

  it('should gate every browser step on the detect output', () => {
    const steps = unitSteps()
    const ungated = browserSteps.filter(
      (name) => !stepNamed(steps, name).if?.includes(GATE),
    )

    expect(ungated).toEqual([])
  })

  it('should leave the detect step as the only new step without the gate', () => {
    const ungated = unitSteps()
      .filter((step) => !step.if)
      .map((step) => step.name)

    expect(ungated).toEqual([
      'Checkout',
      'Setup Node',
      'Setup Bun',
      'Install Dependencies',
      'Detect Browser Tests',
      'Run Tests',
    ])
  })

  it('should install the browser before Run Tests and run browser tests after it', () => {
    const names = unitSteps().map((step) => step.name)
    const runTests = names.indexOf('Run Tests')

    expect(names.indexOf('Install Playwright Chromium')).toBeLessThan(runTests)
    expect(names.indexOf('Run Browser Tests')).toBeGreaterThan(runTests)
  })

  it('should skip the Chromium download on a cache hit', () => {
    const install = stepNamed(unitSteps(), 'Install Playwright Chromium')

    expect(install.if).toContain(
      "steps.playwright-cache.outputs.cache-hit != 'true'",
    )
  })

  it('should share the e2e shard cache key so the browser downloads once', () => {
    const unitKey = stepNamed(unitSteps(), 'Cache Playwright Browsers').with
      ?.key
    const e2eKey = stepNamed(
      readJobs()['e2e-shards'].steps,
      'Cache Playwright Browsers',
    ).with?.key

    expect(unitKey).toBeDefined()
    expect(unitKey).toBe(e2eKey)
  })
})

describe('web verify.yml build-verify job', () => {
  const buildSteps = (): WorkflowStep[] => readJobs()['build-verify'].steps

  it.each([
    ['Check Card Exclusion', 'scripts/check-card-exclusion.sh'],
    ['Check Head Tags', 'scripts/check-head-meta.sh'],
  ])('should run %s where its script is installed', (name, script) => {
    const step = stepNamed(buildSteps(), name)

    expect(step.run).toBe(`bash ${script}`)
    expect(step.if).toBe(`hashFiles('${script}') != ''`)
  })

  it('should read the build only after it exists', () => {
    const names = buildSteps().map((step) => step.name)

    expect(names.slice(names.indexOf('Build'))).toEqual([
      'Build',
      'Check Card Exclusion',
      'Check Head Tags',
      'Upload Build Output',
    ])
  })
})

describe('web verify.yml e2e-shards job', () => {
  const shards = (): WorkflowJob => readJobs()['e2e-shards']

  it('should wait on the build alone', () => {
    expect(shards().needs).toBe('build-verify')
  })

  it('should let every shard finish after one fails', () => {
    expect(shards().strategy?.['fail-fast']).toBe(false)
  })

  it('should run each shard of one total exactly once', () => {
    const matrix = shards().strategy?.matrix
    const [total = 0] = matrix?.shardTotal ?? []

    expect(matrix?.shardTotal).toHaveLength(1)
    expect(matrix?.shardIndex).toEqual(
      Array.from({ length: total }, (_, index) => index + 1),
    )
  })

  it('should pass the matrix shard to the suite', () => {
    const step = stepNamed(shards().steps, 'Run E2E Tests')

    expect(step.env?.SHARD).toBe(
      '${{ matrix.shardIndex }}/${{ matrix.shardTotal }}',
    )
    expect(step.run).toContain('--shard="$SHARD"')
  })

  it('should list the unsharded suite before the shard, so an empty suite fails', () => {
    const steps = shards().steps
    const names = steps.map((step) => step.name)
    const list = stepNamed(steps, 'Require Specs').run

    expect(list).toBe('bun run test:e2e --list --project=chromium')
    expect(names.indexOf('Require Specs')).toBeLessThan(
      names.indexOf('Run E2E Tests'),
    )
  })

  it('should name each report for its shard so two uploads never collide', () => {
    const upload = stepNamed(shards().steps, 'Upload E2E Report')

    expect(upload.if).toBe('failure()')
    expect(upload.with?.name).toContain('${{ matrix.shardIndex }}')
  })
})

describe('web verify.yml e2e-tests summary job', () => {
  const summary = (): WorkflowJob => readJobs()['e2e-tests']

  // Runs the shipped step under the shell the runner gives a `run:` step.
  const report = (result: string): number | null => {
    const step = stepNamed(summary().steps, 'Require Every Shard')
    return spawnSync('bash', ['-e', '-c', step.run ?? ''], {
      env: { ...process.env, SHARDS_RESULT: result },
    }).status
  }

  it('should report under the name a target ruleset requires', () => {
    expect(summary().name).toBe('🎭 E2E Tests')
  })

  it('should run whatever the shards did', () => {
    expect(summary().needs).toBe('e2e-shards')
    expect(summary().if).toBe('always()')
  })

  it('should read the aggregate shard result', () => {
    const step = stepNamed(summary().steps, 'Require Every Shard')

    expect(step.env?.SHARDS_RESULT).toBe('${{ needs.e2e-shards.result }}')
  })

  it('should pass when every shard succeeded', () => {
    expect(report('success')).toBe(0)
  })

  it.each(['failure', 'cancelled', 'skipped', ''])(
    'should fail when the shards read "%s"',
    (result) => {
      expect(report(result)).toBe(1)
    },
  )
})

describe('web verify.yml detect step', () => {
  let fixture: string
  let output: string

  beforeEach(() => {
    fixture = mkdtempSync(join(tmpdir(), 'web-verify-workflow-'))
    output = join(fixture, 'github-output')
    writeFileSync(output, '')
  })

  afterEach(() => {
    rmSync(fixture, { force: true, recursive: true })
  })

  const detect = (
    packageJson: object,
  ): { status: number | null; written: string } => {
    writeFileSync(join(fixture, 'package.json'), JSON.stringify(packageJson))
    const script = stepNamed(unitSteps(), 'Detect Browser Tests').run ?? ''
    const result = spawnSync('bash', ['-e', '-c', script], {
      cwd: fixture,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: output },
    })
    return { status: result.status, written: readFileSync(output, 'utf8') }
  }

  it('should enable when package.json defines test:browser', () => {
    const result = detect({
      scripts: { 'test:browser': 'vitest --project browser' },
    })

    expect(result.written).toBe('enabled=true\n')
  })

  it('should stay silent and green when test:browser is absent', () => {
    const result = detect({ scripts: { test: 'vitest' } })

    expect(result).toEqual({ status: 0, written: '' })
  })

  it('should stay silent and green when package.json has no scripts block', () => {
    const result = detect({ name: 'bare' })

    expect(result).toEqual({ status: 0, written: '' })
  })

  it('should count an empty test:browser string as present so the run step fails loudly', () => {
    const result = detect({ scripts: { 'test:browser': '' } })

    expect(result.written).toBe('enabled=true\n')
  })
})
