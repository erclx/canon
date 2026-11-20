import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { practices } from './practice'

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const read = (path: string) => readFileSync(`${ROOT}${path}`, 'utf8')

describe('practices', () => {
  it.each(practices)(
    'should quote $name word for word from its ledger row',
    ({ quote, ledger }) => {
      expect(read(ledger)).toContain(quote)
    },
  )

  it.each(practices)(
    'should link $name to the address its ledger row cites',
    ({ quote, ledger, url }) => {
      const row = read(ledger)
        .split('\n')
        .find((line) => line.includes(quote))

      expect(row).toContain(`](${url})`)
    },
  )
})
