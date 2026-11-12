import { describe, expect, it } from 'vitest'
import { selectFixtures } from '@/take/fixtures/pr-reel'

const FOLDER = [
  'motion.html',
  'motion.json',
  'scrollbars.html',
  'scrollbars.json',
  'focus.html',
  'pr-reel.ts',
]

describe('selectFixtures', () => {
  it('should film nothing when no path under the engine changed', () => {
    const selection = selectFixtures(['src/pr/lift.ts', 'README.md'], FOLDER)

    expect(selection).toEqual({ kind: 'untouched' })
  })

  it('should film nothing when only engine tests changed', () => {
    const selection = selectFixtures(
      ['src/take/camera.test.ts', 'src/take/film.e2e.test.ts'],
      FOLDER,
    )

    expect(selection).toEqual({ kind: 'untouched' })
  })

  it('should film a changed fixture with its plan beside it', () => {
    const selection = selectFixtures(
      ['src/take/fixtures/scrollbars.html', 'src/take/film.ts'],
      FOLDER,
    )

    expect(selection).toEqual({
      kind: 'film',
      stems: ['scrollbars'],
      fallback: false,
    })
  })

  it('should fall back to motion when the changed fixture has no plan', () => {
    const selection = selectFixtures(['src/take/fixtures/focus.html'], FOLDER)

    expect(selection).toEqual({
      kind: 'film',
      stems: ['motion'],
      fallback: true,
    })
  })

  it('should fall back to motion when an engine file changed and no fixture did', () => {
    const selection = selectFixtures(['src/take/camera.ts'], FOLDER)

    expect(selection).toEqual({
      kind: 'film',
      stems: ['motion'],
      fallback: true,
    })
  })

  it('should film every changed planned fixture once, in name order', () => {
    const selection = selectFixtures(
      [
        'src/take/fixtures/scrollbars.html',
        'src/take/fixtures/motion.html',
        'src/take/fixtures/focus.html',
      ],
      FOLDER,
    )

    expect(selection).toEqual({
      kind: 'film',
      stems: ['motion', 'scrollbars'],
      fallback: false,
    })
  })
})
