import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readStop } from '@/sessions/stop'

const ID = '2cb831b1-b32c-4d57-80a8-d23cbc5ef81e'
const MIB = 1024 * 1024

const USER = { type: 'user', message: { role: 'user', content: 'go' } }

const IDLE = {
  type: 'assistant',
  isSidechain: false,
  message: {
    model: 'claude-opus-5-5',
    content: [{ type: 'text', text: 'Done.' }],
  },
}

function stopEntry(text: string, fields: object = {}): object {
  return {
    type: 'assistant',
    isSidechain: false,
    error: 'rate_limit',
    isApiErrorMessage: true,
    apiErrorStatus: 429,
    message: { model: '<synthetic>', content: [{ type: 'text', text }] },
    ...fields,
  }
}

const STOP = stopEntry(
  "You've hit your session limit · resets 3:30pm (Europe/Stockholm)",
)

let DIR: string

function seed(content: string): void {
  const folder = join(DIR, '-machine-repo')
  mkdirSync(folder, { recursive: true })
  writeFileSync(join(folder, `${ID}.jsonl`), content)
}

function lines(...entries: object[]): string {
  return entries.map((entry) => `${JSON.stringify(entry)}\n`).join('')
}

function read(status = 'idle') {
  return readStop({ status, sessionId: ID }, DIR)
}

beforeEach(() => {
  DIR = mkdtempSync(join(tmpdir(), 'canon-stop-'))
})

afterEach(() => {
  rmSync(DIR, { recursive: true, force: true })
})

describe('readStop over a whole transcript', () => {
  it('should report a usage limit with the text after resets', () => {
    seed(lines(USER, STOP))

    expect(read()).toEqual({
      stopped: 'usage-limit',
      stopResets: '3:30pm (Europe/Stockholm)',
    })
  })

  it('should report a usage limit with no reset when the text names none', () => {
    seed(lines(stopEntry("You've hit your weekly limit")))

    expect(read()).toEqual({ stopped: 'usage-limit', stopResets: null })
  })

  it('should read a session whose last assistant entry answered as not stopped', () => {
    seed(lines(STOP, USER, IDLE))

    expect(read()).toEqual({ stopped: null, stopResets: null })
  })

  it('should stay stopped when only a user entry follows the stop', () => {
    seed(lines(STOP, USER))

    expect(read().stopped).toBe('usage-limit')
  })

  it('should ignore a sidechain entry after the stop', () => {
    seed(lines(STOP, { ...IDLE, isSidechain: true }))

    expect(read().stopped).toBe('usage-limit')
  })

  it('should not take a sidechain stop for the session stopping', () => {
    seed(lines(IDLE, stopEntry('resets soon', { isSidechain: true })))

    expect(read().stopped).toBeNull()
  })

  it('should stay stopped through the entries a client restart appends', () => {
    seed(
      lines(
        STOP,
        {
          type: 'user',
          message: {
            role: 'user',
            content: 'Continue from where you left off.',
          },
        },
        {
          type: 'assistant',
          isSidechain: false,
          message: {
            model: '<synthetic>',
            content: [{ type: 'text', text: 'No response requested.' }],
          },
        },
      ),
    )

    expect(read().stopped).toBe('usage-limit')
  })

  it('should read null when only a restart entry stands in the file', () => {
    seed(
      lines({
        type: 'assistant',
        isSidechain: false,
        message: {
          model: '<synthetic>',
          content: [{ type: 'text', text: 'No response requested.' }],
        },
      }),
    )

    expect(read().stopped).toBeNull()
  })

  it('should skip a line that does not parse', () => {
    seed(`${lines(STOP)}{"type":"assistant","isSide`)

    expect(read().stopped).toBe('usage-limit')
  })

  it('should read null for a whole file carrying no assistant entry', () => {
    seed(lines(USER))

    expect(read()).toEqual({ stopped: null, stopResets: null })
  })

  it('should read null for an empty file', () => {
    seed('')

    expect(read()).toEqual({ stopped: null, stopResets: null })
  })
})

describe('readStop when the entry moved shape', () => {
  const MOVED = "You've hit your 5-hour limit · resets 9pm"

  it.each([
    [
      'a renamed error field on a synthetic entry',
      {
        type: 'assistant',
        isSidechain: false,
        kind: 'rate_limit',
        message: {
          model: '<synthetic>',
          content: [{ type: 'text', text: MOVED }],
        },
      },
    ],
    [
      'another error value on an api error entry',
      stopEntry(MOVED, {
        error: 'quota',
        isApiErrorMessage: true,
        message: {
          model: 'claude-opus-5-5',
          content: [{ type: 'text', text: MOVED }],
        },
      }),
    ],
    ['a stop entry whose type moved', stopEntry(MOVED, { type: 'error' })],
  ])('should read unknown for %s', (_name, entry) => {
    seed(lines(entry))

    expect(read()).toEqual({ stopped: 'unknown', stopResets: null })
  })

  it('should read unknown for a moved-type stop after an answered turn', () => {
    seed(lines(IDLE, stopEntry(MOVED, { type: 'error' })))

    expect(read()).toEqual({ stopped: 'unknown', stopResets: null })
  })

  it('should read null for a model turn quoting the wording', () => {
    seed(
      lines({
        type: 'assistant',
        isSidechain: false,
        message: {
          model: 'claude-opus-5-5',
          content: [{ type: 'text', text: MOVED }],
        },
      }),
    )

    expect(read().stopped).toBeNull()
  })

  it('should read null for a synthetic entry with other wording', () => {
    seed(
      lines(
        stopEntry('Request failed', {
          error: 'server_error',
        }),
      ),
    )

    expect(read().stopped).toBeNull()
  })
})

describe('readStop over a cut window', () => {
  const filler = `${JSON.stringify({ type: 'user', pad: 'x'.repeat(4096) })}\n`

  it('should find a stop at the tail of a file past the window', () => {
    seed(`${filler.repeat(Math.ceil((2 * MIB) / filler.length))}${lines(STOP)}`)

    expect(read().stopped).toBe('usage-limit')
  })

  it('should read unknown when the window holds no assistant entry', () => {
    const tail = filler.repeat(Math.ceil((2 * MIB) / filler.length))
    seed(`${lines(IDLE)}${tail}`)

    expect(read()).toEqual({ stopped: 'unknown', stopResets: null })
  })

  it('should drop the first line of a cut window even when it parses', () => {
    const stop = lines(STOP)
    const rest = Buffer.byteLength(stop)
    const padLine = (size: number) =>
      `${JSON.stringify({ type: 'user', pad: 'x'.repeat(size - 25) })}\n`
    seed(`${lines(USER)}${stop}${padLine(MIB - rest)}`)

    expect(read()).toEqual({ stopped: 'unknown', stopResets: null })
  })
})

describe('readStop when nothing can be read', () => {
  it('should read null for a busy row and never look at the transcript', () => {
    seed(lines(STOP))

    expect(read('busy')).toEqual({ stopped: null, stopResets: null })
  })

  it('should read unknown for a row with no session id', () => {
    expect(readStop({ status: 'idle', sessionId: null }, DIR)).toEqual({
      stopped: 'unknown',
      stopResets: null,
    })
  })

  it('should read unknown when no transcript carries the id', () => {
    expect(read()).toEqual({ stopped: 'unknown', stopResets: null })
  })

  it('should read unknown when the read throws', () => {
    mkdirSync(join(DIR, '-machine-repo', `${ID}.jsonl`), { recursive: true })

    expect(read()).toEqual({ stopped: 'unknown', stopResets: null })
  })

  it.each(['shell', 'waiting', 'idle'])(
    'should still read a row whose status is %s',
    (status) => {
      seed(lines(STOP))

      expect(read(status).stopped).toBe('usage-limit')
    },
  )
})
