import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CLI, RUN_TIMEOUT_MS } from '@/commands/pr/fixture'

describe('canon pr frames', () => {
  let tempDir: string
  let bin: string
  let callLog: string

  /**
   * A gh that answers the frames branch as missing and refuses every write
   * with the status a token lacking write access gets, logging each call.
   */
  function writeReadOnlyGh(): void {
    mkdirSync(bin, { recursive: true })
    writeFileSync(
      join(bin, 'gh'),
      readFileSync(
        new URL('../fixtures/gh-read-only.sh', import.meta.url),
        'utf8',
      ),
      { mode: 0o755 },
    )
  }

  async function runFrames(
    args: string[],
  ): Promise<{ readonly record: { reason?: string }; readonly exit: number }> {
    const result = await execa(
      process.execPath,
      [CLI, 'pr', 'frames', '--json', '--root', tempDir, ...args],
      {
        cwd: tempDir,
        reject: false,
        timeout: RUN_TIMEOUT_MS,
        env: { FAKE_LOG: callLog, PATH: `${bin}:${process.env.PATH}` },
      },
    )
    return { record: JSON.parse(result.stdout), exit: result.exitCode ?? -1 }
  }

  function calls(): string[] {
    return existsSync(callLog)
      ? readFileSync(callLog, 'utf8').split('\n').filter(Boolean)
      : []
  }

  function addArgs(file: string): string[] {
    return [
      '7',
      '--add',
      join(tempDir, file),
      '--box',
      '1',
      '--head',
      'abc1234',
      '--pass',
      '20261002T154450Z',
    ]
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'canon-pr-frames-'))
    bin = join(tempDir, 'bin')
    callLog = join(tempDir, 'gh.log')
    writeReadOnlyGh()
    writeFileSync(
      join(tempDir, 'box-1.png'),
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]),
    )
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should refuse as bad-mode when no mode is passed', async () => {
    const outcome = await runFrames(['7'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'bad-mode' }),
      exit: 1,
    })
  })

  it('should refuse as bad-mode when --add and --drop are both passed', async () => {
    const outcome = await runFrames([...addArgs('box-1.png'), '--drop'])

    expect(outcome.record.reason).toBe('bad-mode')
  })

  it('should refuse as bad-mode when --prune names a pull request', async () => {
    const outcome = await runFrames(['7', '--prune', '30'])

    expect(outcome.record.reason).toBe('bad-mode')
  })

  it('should refuse as no-number when --drop names no pull request', async () => {
    const outcome = await runFrames(['--drop'])

    expect(outcome.record.reason).toBe('no-number')
  })

  it('should refuse as bad-box when --add carries no box', async () => {
    const outcome = await runFrames(['7', '--add', 'box-1.png'])

    expect(outcome.record.reason).toBe('bad-box')
  })

  it('should refuse as bad-head without calling gh when --head names no commit', async () => {
    const outcome = await runFrames([...addArgs('box-1.png'), '--head', 'main'])

    expect({ reason: outcome.record.reason, calls: calls() }).toEqual({
      reason: 'bad-head',
      calls: [],
    })
  })

  it('should refuse as bad-pass when --add carries no pass stamp', async () => {
    const outcome = await runFrames([
      '7',
      '--add',
      join(tempDir, 'box-1.png'),
      '--box',
      '1',
      '--head',
      'abc1234',
    ])

    expect(outcome.record.reason).toBe('bad-pass')
  })

  it('should refuse as bad-pass when the stamp is not compact UTC', async () => {
    const outcome = await runFrames([
      ...addArgs('box-1.png'),
      '--pass',
      '2026-10-02T15:44:50Z',
    ])

    expect(outcome.record.reason).toBe('bad-pass')
  })

  it('should refuse as bad-theme when --theme is neither dark nor light', async () => {
    const outcome = await runFrames([
      ...addArgs('box-1.png'),
      '--theme',
      'sepia',
    ])

    expect(outcome.record.reason).toBe('bad-theme')
  })

  it('should refuse as bad-theme without calling gh when --theme comes without --add', async () => {
    const outcome = await runFrames(['7', '--drop', '--theme', 'dark'])

    expect({ reason: outcome.record.reason, calls: calls() }).toEqual({
      reason: 'bad-theme',
      calls: [],
    })
  })

  it('should refuse as bad-days when --prune is not a positive number', async () => {
    const outcome = await runFrames(['--prune', '0'])

    expect(outcome.record.reason).toBe('bad-days')
  })

  it('should refuse as unreadable-frame without calling gh when the file is not a PNG', async () => {
    writeFileSync(join(tempDir, 'notes.png'), 'text')

    const outcome = await runFrames(addArgs('notes.png'))

    expect({ outcome, calls: calls() }).toEqual({
      outcome: {
        record: expect.objectContaining({ reason: 'unreadable-frame' }),
        exit: 1,
      },
      calls: [],
    })
  })

  it('should refuse as read-only when GitHub refuses the write', async () => {
    const outcome = await runFrames(addArgs('box-1.png'))

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'read-only' }),
      exit: 1,
    })
  })

  it('should report nothing removed when --drop finds the branch missing', async () => {
    const outcome = await runFrames(['7', '--drop'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'ok', removed: [] }),
      exit: 0,
    })
  })

  it('should address no ref but the canon/frames branch', async () => {
    await runFrames(addArgs('box-1.png'))

    const refCalls = calls().filter((call) => call.includes('/git/ref'))
    expect(refCalls.every((call) => call.includes('heads/canon/frames'))).toBe(
      true,
    )
  })

  it('should read only canon/frames and the legacy ref on --drop and report ok', async () => {
    const outcome = await runFrames(['7', '--drop'])

    const refCalls = calls().filter((call) => call.includes('/git/ref'))
    expect({ outcome, refCalls: refCalls.length }).toEqual({
      outcome: {
        record: expect.objectContaining({ reason: 'ok', removed: [] }),
        exit: 0,
      },
      refCalls: 2,
    })
    expect(
      refCalls.every(
        (call) =>
          call.includes('heads/canon/frames') ||
          call.includes('heads/canon-frames'),
      ),
    ).toBe(true)
  })

  it('should drain the legacy ref on --prune without a new refusal when it is missing', async () => {
    const outcome = await runFrames(['--prune', '30'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'ok', removed: [] }),
      exit: 0,
    })
  })

  it('should never read the legacy ref on --add', async () => {
    await runFrames(addArgs('box-1.png'))

    expect(calls().filter((call) => call.includes('canon-frames'))).toEqual([])
  })

  it('should refuse as bad-box when --add carries both --box and --reference', async () => {
    const outcome = await runFrames([
      ...addArgs('box-1.png'),
      '--reference',
      'home/hero',
    ])

    expect(outcome.record.reason).toBe('bad-box')
    expect(calls()).toEqual([])
  })

  it('should refuse as bad-reference when the address would escape the pass folder', async () => {
    const outcome = await runFrames([
      '7',
      '--add',
      join(tempDir, 'box-1.png'),
      '--reference',
      '../../x',
      '--pass',
      '20261002T154450Z',
    ])

    expect(outcome.record.reason).toBe('bad-reference')
    expect(calls()).toEqual([])
  })

  it('should refuse as bad-reference naming the path when a tracked reference does not exist', async () => {
    const outcome = await runFrames([
      '7',
      '--add',
      join(tempDir, 'box-1.png'),
      '--reference',
      'canon/design/button/dark.png',
      '--head',
      'abc1234',
      '--pass',
      '20261002T154450Z',
    ])

    expect({ reason: outcome.record.reason, calls: calls() }).toEqual({
      reason: 'bad-reference',
      calls: [],
    })
    expect(JSON.stringify(outcome.record)).toContain(
      'canon/design/button/dark.png',
    )
  })

  describe('a tracked reference', () => {
    const REFERENCE = 'canon/design/button/dark.png'

    function trackedArgs(add: string, reference: string): string[] {
      return [
        '7',
        '--add',
        add,
        '--reference',
        reference,
        '--head',
        'abc1234',
        '--pass',
        '20261002T154450Z',
      ]
    }

    function seedReference(): string {
      mkdirSync(join(tempDir, 'canon', 'design', 'button'), {
        recursive: true,
      })
      const file = join(tempDir, REFERENCE)
      writeFileSync(file, readFileSync(join(tempDir, 'box-1.png')))
      return file
    }

    it('should pass when --add names the tracked file itself', async () => {
      const file = seedReference()

      const outcome = await runFrames(trackedArgs(file, REFERENCE))

      expect(outcome.record.reason).toBe('read-only')
    })

    it('should resolve the png extension a reference leaves off', async () => {
      const file = seedReference()

      const outcome = await runFrames(
        trackedArgs(file, 'canon/design/button/dark'),
      )

      expect(outcome.record.reason).toBe('read-only')
    })

    it('should refuse as bad-reference when --add names a different image', async () => {
      seedReference()

      const outcome = await runFrames(
        trackedArgs(join(tempDir, 'box-1.png'), REFERENCE),
      )

      expect({ reason: outcome.record.reason, calls: calls() }).toEqual({
        reason: 'bad-reference',
        calls: [],
      })
    })

    it('should refuse as bad-reference when the path is a directory', async () => {
      mkdirSync(join(tempDir, REFERENCE), { recursive: true })

      const outcome = await runFrames(
        trackedArgs(join(tempDir, 'box-1.png'), REFERENCE),
      )

      expect(outcome.record.reason).toBe('bad-reference')
    })
  })

  it('should refuse as bad-theme when --theme rides a reference', async () => {
    const outcome = await runFrames([
      '7',
      '--add',
      join(tempDir, 'box-1.png'),
      '--reference',
      'home/hero',
      '--theme',
      'dark',
      '--pass',
      '20261002T154450Z',
    ])

    expect(outcome.record.reason).toBe('bad-theme')
  })

  it('should pass a valid reference through to the write', async () => {
    const outcome = await runFrames([
      '7',
      '--add',
      join(tempDir, 'box-1.png'),
      '--reference',
      'home/hero',
      '--head',
      'abc1234',
      '--pass',
      '20261002T154450Z',
    ])

    expect(outcome.record.reason).toBe('read-only')
  })

  describe('with --reel', () => {
    const WEBP = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1,
    ])

    function reelArgs(file: string): string[] {
      return [
        '7',
        '--reel',
        join(tempDir, file),
        '--head',
        'abc1234',
        '--pass',
        '20261002T154450Z',
      ]
    }

    it('should reach the write for a WebP reel', async () => {
      writeFileSync(join(tempDir, 'reel.webp'), WEBP)

      const outcome = await runFrames(reelArgs('reel.webp'))

      // The fake gh refuses every write, so reaching it reads as read-only.
      expect(outcome.record.reason).toBe('read-only')
    })

    it('should refuse as unreadable-reel without calling gh for a PNG or an MP4', async () => {
      writeFileSync(
        join(tempDir, 'reel.mp4'),
        new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73]),
      )

      const png = await runFrames(reelArgs('box-1.png'))
      const mp4 = await runFrames(reelArgs('reel.mp4'))

      expect({
        reasons: [png.record.reason, mp4.record.reason],
        calls: calls(),
      }).toEqual({
        reasons: ['unreadable-reel', 'unreadable-reel'],
        calls: [],
      })
    })

    it('should refuse as reel-too-large without calling gh past 10 MB', async () => {
      const big = new Uint8Array(10_000_001)
      big.set(WEBP)
      writeFileSync(join(tempDir, 'big.webp'), big)

      const outcome = await runFrames(reelArgs('big.webp'))

      expect({ outcome, calls: calls() }).toEqual({
        outcome: {
          record: expect.objectContaining({ reason: 'reel-too-large' }),
          exit: 1,
        },
        calls: [],
      })
    })

    it('should refuse as bad-box when --reel rides a --box', async () => {
      writeFileSync(join(tempDir, 'reel.webp'), WEBP)

      const outcome = await runFrames([...reelArgs('reel.webp'), '--box', '1'])

      expect(outcome.record.reason).toBe('bad-box')
    })

    it('should refuse as bad-mode when --reel and --add are both passed', async () => {
      writeFileSync(join(tempDir, 'reel.webp'), WEBP)

      const outcome = await runFrames([
        ...reelArgs('reel.webp'),
        '--add',
        join(tempDir, 'box-1.png'),
      ])

      expect(outcome.record.reason).toBe('bad-mode')
    })

    it('should refuse as bad-pass when --reel carries no pass stamp', async () => {
      writeFileSync(join(tempDir, 'reel.webp'), WEBP)

      const outcome = await runFrames([
        '7',
        '--reel',
        join(tempDir, 'reel.webp'),
      ])

      expect(outcome.record.reason).toBe('bad-pass')
    })
  })

  it('should list every refusal reason in the help text', async () => {
    const result = await execa(
      process.execPath,
      [CLI, 'pr', 'frames', '--help'],
      { reject: false, timeout: RUN_TIMEOUT_MS },
    )

    expect(
      [
        'bad-mode',
        'no-number',
        'bad-box',
        'bad-reference',
        'bad-days',
        'unreadable-frame',
        'unreadable-reel',
        'reel-too-large',
        'read-only',
        'unreadable-tip',
        'push-failed',
        'ref-conflict',
        'bad-head',
        'bad-pass',
      ].filter((reason) => !result.stdout.includes(reason)),
    ).toEqual([])
  })
})
