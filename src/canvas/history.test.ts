import { describe, expect, it } from 'vitest'
import {
  type ApplyResult,
  type ElementEntry,
  History,
  type HistoryEntry,
  type Direction,
} from '@/canvas/history'

function elementEntry(overrides: Partial<ElementEntry> = {}): ElementEntry {
  return {
    kind: 'element',
    page: 'drafts',
    frame: 'hero',
    index: 4,
    tag: 'h1',
    count: 9,
    before: { style: undefined },
    after: { style: 'color: red' },
    ...overrides,
  }
}

/** An apply that records what it was handed and answers as told. */
function recorder(result: ApplyResult = 'applied') {
  const calls: { entry: HistoryEntry; direction: Direction }[] = []
  const apply = (entry: HistoryEntry, direction: Direction) => {
    calls.push({ entry, direction })
    return result
  }
  return { calls, apply }
}

describe('History', () => {
  it('should report nothing to undo or redo when empty', () => {
    const history = new History()

    expect(history.flags()).toEqual({ canUndo: false, canRedo: false })
    expect(history.undo(recorder().apply)).toBe('empty')
  })

  it('should hand the latest entry to undo and move it to redo', () => {
    const history = new History()
    const entry = elementEntry()
    history.record(entry)
    const { calls, apply } = recorder()

    const outcome = history.undo(apply)

    expect(outcome).toBe('applied')
    expect(calls).toEqual([{ entry, direction: 'undo' }])
    expect(history.flags()).toEqual({ canUndo: false, canRedo: true })
  })

  it('should hand an undone entry back to redo and restore it to undo', () => {
    const history = new History()
    const entry = elementEntry()
    history.record(entry)
    history.undo(recorder().apply)
    const { calls, apply } = recorder()

    const outcome = history.redo(apply)

    expect(outcome).toBe('applied')
    expect(calls).toEqual([{ entry, direction: 'redo' }])
    expect(history.flags()).toEqual({ canUndo: true, canRedo: false })
  })

  it('should clear redo when a new entry is recorded', () => {
    const history = new History()
    history.record(elementEntry())
    history.undo(recorder().apply)

    history.record(elementEntry({ index: 7 }))

    expect(history.flags()).toEqual({ canUndo: true, canRedo: false })
  })

  it('should merge entries sharing a step on one element into one', () => {
    const history = new History()
    history.record(
      elementEntry({
        step: 'drag-1',
        before: { style: undefined },
        after: { style: 'width: 10px' },
      }),
    )
    history.record(
      elementEntry({
        step: 'drag-1',
        before: { style: 'width: 10px' },
        after: { style: 'width: 10px; height: 20px' },
      }),
    )
    const { calls, apply } = recorder()

    history.undo(apply)

    expect(calls).toHaveLength(1)
    expect(calls[0]?.entry).toMatchObject({
      before: { style: undefined },
      after: { style: 'width: 10px; height: 20px' },
    })
    expect(history.flags().canUndo).toBe(false)
  })

  it('should keep entries with no step apart', () => {
    const history = new History()
    history.record(elementEntry())
    history.record(elementEntry())

    history.undo(recorder().apply)

    expect(history.flags().canUndo).toBe(true)
  })

  it('should drop the oldest entry past the cap', () => {
    const history = new History(2)
    history.record(elementEntry({ index: 1 }))
    history.record(elementEntry({ index: 2 }))
    history.record(elementEntry({ index: 3 }))
    const { calls, apply } = recorder()

    history.undo(apply)
    history.undo(apply)
    const third = history.undo(apply)

    expect(calls.map(({ entry }) => (entry as ElementEntry).index)).toEqual([
      3, 2,
    ])
    expect(third).toBe('empty')
  })

  it('should drop an entry the apply reports as changed', () => {
    const history = new History()
    history.record(elementEntry())

    const outcome = history.undo(recorder('dropped').apply)

    expect(outcome).toBe('dropped')
    expect(history.flags()).toEqual({ canUndo: false, canRedo: false })
  })

  it('should drop a box entry the apply reports as changed', () => {
    const history = new History()
    history.record({
      kind: 'box',
      page: 'drafts',
      frame: 'hero',
      before: { x: 0, y: 0, width: 100, height: 100 },
      after: { x: 40, y: 0, width: 100, height: 100 },
    })
    history.undo(recorder().apply)

    const outcome = history.redo(recorder('dropped').apply)

    expect(outcome).toBe('dropped')
    expect(history.flags()).toEqual({ canUndo: false, canRedo: false })
  })

  it('should keep an entry in place when the file is busy', () => {
    const history = new History()
    history.record(elementEntry())

    const outcome = history.undo(recorder('busy').apply)

    expect(outcome).toBe('busy')
    expect(history.flags()).toEqual({ canUndo: true, canRedo: false })
  })
})
