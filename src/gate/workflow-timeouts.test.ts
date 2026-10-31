import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
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

const REPO_ROOT = join(import.meta.dirname, '../..')

const WORKFLOWS_DIR = join(REPO_ROOT, '.github/workflows')

const TOOLING_DIR = join(REPO_ROOT, 'tooling')

// Canon calls the script under scripts/ci/ and a target under scripts/, so
// the basename is what names both
const INSTALL_SCRIPT = 'install-playwright-deps.sh'

// A stack's workflows reach every target that installs it, so the gate reads
// them beside canon's own
const shippedWorkflowDirs = readdirSync(TOOLING_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(TOOLING_DIR, entry.name, 'configs/.github/workflows'))
  .filter((dir) => existsSync(dir))

const readJobs = (path: string): Record<string, WorkflowJob> => {
  const parsed = Bun.YAML.parse(readFileSync(path, 'utf8')) as {
    jobs: Record<string, WorkflowJob>
  }
  return parsed.jobs
}

const workflowFiles = [WORKFLOWS_DIR, ...shippedWorkflowDirs].flatMap((dir) =>
  readdirSync(dir)
    .filter((file) => /\.ya?ml$/.test(file))
    .map((file) => join(dir, file)),
)

const allSteps = (): { file: string; step: WorkflowStep }[] =>
  workflowFiles.flatMap((path) =>
    Object.values(readJobs(path)).flatMap((job) =>
      (job.steps ?? []).map((step) => ({
        file: relative(REPO_ROOT, path),
        step,
      })),
    ),
  )

describe.each(['pr-visual-checks.yml', 'refresh-capture-frames.yml'])(
  '%s',
  (file) => {
    it('should bound every job with a timeout', () => {
      const unbounded = Object.entries(readJobs(join(WORKFLOWS_DIR, file)))
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

    expect(steps).toHaveLength(7)
    expect(unbounded).toEqual([])
  })
})
