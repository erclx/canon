import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { craftScenes, practices } from './practice'

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const read = (path: string) => readFileSync(`${ROOT}${path}`, 'utf8')

describe('practices', () => {
  it.each(practices)(
    'should quote $name word for word from its ledger row',
    ({ quote, ledger }) => {
      expect(read(ledger)).toContain(quote)
    },
  )

  it('should load every listed skill in some scene of the window', () => {
    const loaded = craftScenes.flatMap((scene) =>
      scene.lines
        .filter(([tool]) => tool === 'Skill')
        .map(([, name]) => name.replace('canon:', '')),
    )

    expect(
      practices.map((p) => p.name).filter((n) => !loaded.includes(n)),
    ).toEqual([])
  })
})
