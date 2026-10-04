import { describe, expect, it } from 'vitest'
import { type KeyInput, surfaceAction } from '@/canvas/client/keys'

function key(overrides: Partial<KeyInput>): KeyInput {
  return {
    type: 'keydown',
    key: '',
    code: '',
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...overrides,
  }
}

describe('surfaceAction', () => {
  it('should pick the move tool on V', () => {
    expect(surfaceAction(key({ key: 'v', code: 'KeyV' }))).toBe('tool-move')
  })

  it('should pick the move tool on V with caps lock on', () => {
    expect(surfaceAction(key({ key: 'V', code: 'KeyV' }))).toBe('tool-move')
  })

  it('should pick the pan tool on H', () => {
    expect(surfaceAction(key({ key: 'h', code: 'KeyH' }))).toBe('tool-pan')
  })

  it('should zoom in on plus', () => {
    expect(
      surfaceAction(key({ key: '+', code: 'Equal', shiftKey: true })),
    ).toBe('zoom-in')
  })

  it('should zoom in on equals, the plus key without Shift', () => {
    expect(surfaceAction(key({ key: '=', code: 'Equal' }))).toBe('zoom-in')
  })

  it('should zoom out on minus', () => {
    expect(surfaceAction(key({ key: '-', code: 'Minus' }))).toBe('zoom-out')
  })

  it('should fit on Shift and the 1 key whatever character the layout gives', () => {
    expect(
      surfaceAction(key({ key: '!', code: 'Digit1', shiftKey: true })),
    ).toBe('zoom-fit')
  })

  it('should not fit on 1 without Shift', () => {
    expect(surfaceAction(key({ key: '1', code: 'Digit1' }))).toBeUndefined()
  })

  it('should hold a pan while Space is down', () => {
    expect(surfaceAction(key({ key: ' ', code: 'Space' }))).toBe('pan-hold')
  })

  it('should release the pan when Space comes up', () => {
    expect(surfaceAction(key({ type: 'keyup', key: ' ', code: 'Space' }))).toBe(
      'pan-release',
    )
  })

  it('should release the pan when Space comes up with Ctrl held', () => {
    expect(
      surfaceAction(
        key({ type: 'keyup', key: ' ', code: 'Space', ctrlKey: true }),
      ),
    ).toBe('pan-release')
  })

  it('should take no other key coming up', () => {
    expect(
      surfaceAction(key({ type: 'keyup', key: 'v', code: 'KeyV' })),
    ).toBeUndefined()
  })

  it('should leave a letter with Shift held to the page', () => {
    expect(
      surfaceAction(key({ key: 'V', code: 'KeyV', shiftKey: true })),
    ).toBeUndefined()
  })

  it('should leave Ctrl and plus to the browser', () => {
    expect(
      surfaceAction(key({ key: '+', code: 'Equal', ctrlKey: true })),
    ).toBeUndefined()
  })

  it('should leave Cmd and minus to the browser', () => {
    expect(
      surfaceAction(key({ key: '-', code: 'Minus', metaKey: true })),
    ).toBeUndefined()
  })

  it('should leave Ctrl and 0 to the browser', () => {
    expect(
      surfaceAction(key({ key: '0', code: 'Digit0', ctrlKey: true })),
    ).toBeUndefined()
  })

  it('should leave Alt and a letter to the page', () => {
    expect(
      surfaceAction(key({ key: 'h', code: 'KeyH', altKey: true })),
    ).toBeUndefined()
  })

  it('should leave Ctrl and Space to the page', () => {
    expect(
      surfaceAction(key({ key: ' ', code: 'Space', ctrlKey: true })),
    ).toBeUndefined()
  })

  it('should undo on Ctrl and Z', () => {
    expect(surfaceAction(key({ key: 'z', code: 'KeyZ', ctrlKey: true }))).toBe(
      'undo',
    )
  })

  it('should undo on Cmd and Z', () => {
    expect(surfaceAction(key({ key: 'z', code: 'KeyZ', metaKey: true }))).toBe(
      'undo',
    )
  })

  it('should redo on Cmd, Shift, and Z', () => {
    expect(
      surfaceAction(
        key({ key: 'Z', code: 'KeyZ', metaKey: true, shiftKey: true }),
      ),
    ).toBe('redo')
  })

  it('should redo on Ctrl and Y', () => {
    expect(surfaceAction(key({ key: 'y', code: 'KeyY', ctrlKey: true }))).toBe(
      'redo',
    )
  })

  it('should leave Alt and Z to the page', () => {
    expect(
      surfaceAction(key({ key: 'z', code: 'KeyZ', altKey: true })),
    ).toBeUndefined()
  })

  it('should leave Ctrl, Alt, and Z to the page', () => {
    expect(
      surfaceAction(
        key({ key: 'z', code: 'KeyZ', ctrlKey: true, altKey: true }),
      ),
    ).toBeUndefined()
  })

  it('should toggle the panels on backslash', () => {
    expect(surfaceAction(key({ key: '\\', code: 'Backslash' }))).toBe(
      'panels-toggle',
    )
  })

  it('should toggle the panels on the backslash key whatever character a layout gives it', () => {
    expect(surfaceAction(key({ key: '#', code: 'Backslash' }))).toBe(
      'panels-toggle',
    )
  })

  it('should leave Ctrl and backslash to the browser', () => {
    expect(
      surfaceAction(key({ key: '\\', code: 'Backslash', ctrlKey: true })),
    ).toBeUndefined()
  })
})
