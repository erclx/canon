import { describe, expect, it } from 'vitest'
import { toolingNextStep } from '@/commands/sync'
import type { ToolingReport } from '@/sync/check'

function drifted(retired: readonly string[]): ToolingReport {
  return {
    measured: true,
    chain: [...retired, 'base'],
    retired,
    counts: {
      configs: 1,
      customized: 0,
      seeds: 0,
      scripts: 0,
      deps: 0,
      gitignore: 0,
    },
    changes: 1,
  }
}

describe('toolingNextStep', () => {
  it('should point a drifted chain at a tooling write', () => {
    expect(toolingNextStep(drifted([]))).toContain('`--write` to apply')
  })

  it('should offer no write while a retired stack is in the chain', () => {
    expect(toolingNextStep(drifted(['go']))).toBeUndefined()
  })
})
