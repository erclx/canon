import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let forceLockContention = false

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>()

  return {
    ...actual,
    mkdir: async (
      path: Parameters<typeof fs.mkdir>[0],
      options?: Parameters<typeof fs.mkdir>[1],
    ) => {
      const recursive =
        typeof options === 'object' &&
        options !== null &&
        'recursive' in options
          ? options.recursive
          : false

      if (
        forceLockContention &&
        !recursive &&
        String(path).includes('ordinal-locks')
      ) {
        const error = new Error('exists') as NodeJS.ErrnoException
        error.code = 'EEXIST'
        throw error
      }

      return actual.mkdir(path, options)
    },
  }
})

const { claimOrdinal } = await import('@/records/ordinal')

let ROOT: string

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-ordinal-contention-'))
  forceLockContention = false
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
  forceLockContention = false
})

describe('claimOrdinal under sustained contention', () => {
  it('should refuse as ordinal-contended when every reservation attempt loses, stale-recovery included', async () => {
    forceLockContention = true

    const outcome = await claimOrdinal(ROOT, 'intake', 'contended-topic')

    expect(outcome).toMatchObject({
      ok: false,
      reason: 'ordinal-contended',
      lastOrdinal: '01',
    })
  })
})
