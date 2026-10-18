import { describe, expect, it } from 'vitest'
import { type DomainStep, runDomains } from '@/init/run'

function passing(label: string, order: string[]): DomainStep {
  return {
    kind: 'run',
    label,
    run: async () => {
      order.push(label)
      return true
    },
  }
}

// Exercises the failing-domain branch on purpose, and vitest passes its stderr
// through, so a passing `bun run check` prints `Failed, run manually` lines.
// Read the closing verification line rather than grepping for failure strings.
function failing(label: string, order: string[]): DomainStep {
  return {
    kind: 'run',
    label,
    run: async () => {
      order.push(label)
      return false
    },
  }
}

describe('runDomains', () => {
  it('should report no failures when every domain succeeds', async () => {
    const order: string[] = []

    const failed = await runDomains([
      passing('Base tooling', order),
      passing('Snippets', order),
    ])

    expect(failed).toEqual([])
  })

  it('should keep running after a domain fails', async () => {
    const order: string[] = []

    await runDomains([
      failing('Base tooling', order),
      passing('Claude workflow', order),
      passing('Snippets', order),
    ])

    expect(order).toEqual(['Base tooling', 'Claude workflow', 'Snippets'])
  })

  it('should collect every failed label rather than only the first', async () => {
    const order: string[] = []

    const failed = await runDomains([
      failing('Base tooling', order),
      passing('Claude workflow', order),
      failing('Governance', order),
    ])

    expect(failed).toEqual(['Base tooling', 'Governance'])
  })

  it('should run the domains in the order given', async () => {
    const order: string[] = []

    await runDomains([
      passing('Base tooling', order),
      passing('Claude workflow', order),
      passing('Governance', order),
    ])

    expect(order).toEqual(['Base tooling', 'Claude workflow', 'Governance'])
  })

  it('should not count an announced skip as a failure', async () => {
    const order: string[] = []

    const failed = await runDomains([
      {
        kind: 'skip',
        label: 'Governance',
        notice: 'Skipped: --skip governance',
      },
      passing('Snippets', order),
    ])

    expect(failed).toEqual([])
    expect(order).toEqual(['Snippets'])
  })
})
