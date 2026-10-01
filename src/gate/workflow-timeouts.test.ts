import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

interface WorkflowStep {
  name?: string
  run?: string
  'timeout-minutes'?: number
}

interface WorkflowJob {
  'timeout-minutes'?: number
  steps?: WorkflowStep[]
}

const WORKFLOW_PATH = join(
  import.meta.dirname,
  '../../.github/workflows/pr-visual-checks.yml',
)

const readJobs = (): Record<string, WorkflowJob> => {
  const parsed = Bun.YAML.parse(readFileSync(WORKFLOW_PATH, 'utf8')) as {
    jobs: Record<string, WorkflowJob>
  }
  return parsed.jobs
}

describe('pr-visual-checks.yml', () => {
  it('should bound every job with a timeout', () => {
    const unbounded = Object.entries(readJobs())
      .filter(([, job]) => typeof job['timeout-minutes'] !== 'number')
      .map(([id]) => id)

    expect(unbounded).toEqual([])
  })

  it('should bound every playwright install-deps step with a timeout', () => {
    const steps = Object.values(readJobs())
      .flatMap((job) => job.steps ?? [])
      .filter((step) => step.run?.includes('playwright install-deps'))
    const unbounded = steps
      .filter((step) => typeof step['timeout-minutes'] !== 'number')
      .map((step) => step.name)

    expect(steps.length).toBeGreaterThan(0)
    expect(unbounded).toEqual([])
  })
})
