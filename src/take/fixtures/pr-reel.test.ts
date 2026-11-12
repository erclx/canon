import { describe, expect, it } from 'vitest'
import { fitBeats, selectFixtures } from '@/take/fixtures/pr-reel'

function beat(name: string, seconds: number) {
  return { name, seconds }
}

describe('fitBeats', () => {
  it('should keep every beat when they sum within the cap', () => {
    const fit = fitBeats([beat('drag', 4), beat('click', 3)], 12)

    expect(fit).toEqual({
      kept: [beat('drag', 4), beat('click', 3)],
      dropped: [],
    })
  })

  it('should keep a beat that lands exactly on the cap', () => {
    const fit = fitBeats([beat('drag', 6), beat('click', 6)], 12)

    expect(fit.dropped).toEqual([])
  })

  it('should drop the beat that passes the cap and every beat after it', () => {
    const fit = fitBeats(
      [beat('drag', 4), beat('tag', 4), beat('publish', 3), beat('note', 3)],
      12,
    )

    expect(fit).toEqual({
      kept: [beat('drag', 4), beat('tag', 4), beat('publish', 3)],
      dropped: [beat('note', 3)],
    })
  })

  it('should drop a later short beat once an earlier one passed the cap', () => {
    const fit = fitBeats([beat('drag', 10), beat('tag', 5), beat('tap', 1)], 12)

    expect(fit.kept).toEqual([beat('drag', 10)])
  })
})

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
