import { readdirSync, readFileSync } from 'node:fs'
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

const WORKFLOWS_DIR = join(import.meta.dirname, '../../.github/workflows')

const INSTALL_SCRIPT = 'scripts/ci/install-playwright-deps.sh'

const readJobs = (file: string): Record<string, WorkflowJob> => {
  const parsed = Bun.YAML.parse(
    readFileSync(join(WORKFLOWS_DIR, file), 'utf8'),
  ) as { jobs: Record<string, WorkflowJob> }
  return parsed.jobs
}

const workflowFiles = readdirSync(WORKFLOWS_DIR).filter((file) =>
  /\.ya?ml$/.test(file),
)

const allSteps = (): { file: string; step: WorkflowStep }[] =>
  workflowFiles.flatMap((file) =>
    Object.values(readJobs(file)).flatMap((job) =>
      (job.steps ?? []).map((step) => ({ file, step })),
    ),
  )

describe.each(['pr-visual-checks.yml', 'refresh-capture-frames.yml'])(
  '%s',
  (file) => {
    it('should bound every job with a timeout', () => {
      const unbounded = Object.entries(readJobs(file))
        .filter(([, job]) => typeof job['timeout-minutes'] !== 'number')
        .map(([id]) => id)

      expect(unbounded).toEqual([])
    })
  },
)

describe('every workflow', () => {
  // A direct call reaches apt with no retry, so one stalled mirror
  // connection reddens the job
  it('should install playwright system packages only through the retry script', () => {
    const direct = allSteps()
      .filter(({ step }) => /install-deps|--with-deps/.test(step.run ?? ''))
      .map(({ file, step }) => `${file}: ${step.name}`)

    expect(direct).toEqual([])
  })

  it('should bound every retry script step with a timeout', () => {
    const steps = allSteps().filter(({ step }) =>
      step.run?.includes(INSTALL_SCRIPT),
    )
    const unbounded = steps
      .filter(({ step }) => typeof step['timeout-minutes'] !== 'number')
      .map(({ file, step }) => `${file}: ${step.name}`)

    expect(steps).toHaveLength(4)
    expect(unbounded).toEqual([])
  })
})
