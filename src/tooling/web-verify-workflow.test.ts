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
  with?: { key?: string }
}

interface WorkflowJob {
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
    'Install Playwright System Dependencies',
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

  it('should share the e2e job cache key so the browser downloads once', () => {
    const unitKey = stepNamed(unitSteps(), 'Cache Playwright Browsers').with
      ?.key
    const e2eKey = stepNamed(
      readJobs()['e2e-tests'].steps,
      'Cache Playwright Browsers',
    ).with?.key

    expect(unitKey).toBeDefined()
    expect(unitKey).toBe(e2eKey)
  })
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
