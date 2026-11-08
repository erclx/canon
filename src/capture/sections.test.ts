import { describe, expect, it } from 'vitest'
import { mergeBlocks } from '@/capture/sections'

function block(index: number, top: number, height: number) {
  return { index, top, height }
}

describe('mergeBlocks', () => {
  it('should keep blocks at or above the threshold as sections of their own', () => {
    const sections = mergeBlocks(
      [block(0, 0, 600), block(1, 600, 400)],
      400,
      2400,
    )

    expect(sections).toEqual([
      { blocks: [0], top: 0, height: 600 },
      { blocks: [1], top: 600, height: 400 },
    ])
  })

  it('should join a run of short bands to the section above', () => {
    const sections = mergeBlocks(
      [block(0, 0, 800), block(1, 800, 200), block(2, 1000, 300)],
      400,
      2400,
    )

    expect(sections).toEqual([{ blocks: [0, 1, 2], top: 0, height: 1300 }])
  })

  it('should join a short first block to the block below it', () => {
    const sections = mergeBlocks(
      [block(0, 0, 100), block(1, 100, 700)],
      400,
      2400,
    )

    expect(sections).toEqual([{ blocks: [0, 1], top: 0, height: 800 }])
  })

  it('should start a new section when a merge would pass the cap', () => {
    const sections = mergeBlocks(
      [block(0, 0, 2300), block(1, 2300, 200)],
      400,
      2400,
    )

    expect(sections).toEqual([
      { blocks: [0], top: 0, height: 2300 },
      { blocks: [1], top: 2300, height: 200 },
    ])
  })

  it('should keep a short first block apart when joining would pass the cap', () => {
    const sections = mergeBlocks(
      [block(0, 0, 200), block(1, 200, 2300)],
      400,
      2400,
    )

    expect(sections).toEqual([
      { blocks: [0], top: 0, height: 200 },
      { blocks: [1], top: 200, height: 2300 },
    ])
  })

  it('should keep a page of nothing but short blocks as one section', () => {
    const sections = mergeBlocks(
      [block(0, 0, 100), block(1, 100, 100)],
      400,
      2400,
    )

    expect(sections).toEqual([{ blocks: [0, 1], top: 0, height: 200 }])
  })

  it('should return no sections for no blocks', () => {
    expect(mergeBlocks([], 400, 2400)).toEqual([])
  })
})
