import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  frameSuccess,
  intro,
  isNonInteractive,
  logInfo,
  logWarn,
  outro,
  palette,
  supportsColor,
} from '@/cli/ui'

const ROOT = join(import.meta.dirname, '../..')

/** Any SGR sequence. The cursor and key sequences end in a letter instead. */
const SGR = /\x1b\[[\d;]*m/

/** The same sequence as a source literal, in either spelling. */
const SGR_LITERAL = /\\(?:x1b|u001[bB])\[[\d;]*m/

const TERMINAL = { isTTY: true }
const PIPE = { isTTY: undefined }

function withEnv(value: string | undefined, run: () => void): void {
  const before = process.env.NO_COLOR
  if (value === undefined) delete process.env.NO_COLOR
  else process.env.NO_COLOR = value
  try {
    run()
  } finally {
    if (before === undefined) delete process.env.NO_COLOR
    else process.env.NO_COLOR = before
  }
}

/**
 * Vitest already pipes stderr, so the plain case is the ambient one and only
 * the terminal case needs faking. The descriptor is restored either way, since
 * a leaked `isTTY` would silently color every later suite.
 */
function asTerminal(run: () => void): void {
  const before = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY')
  Object.defineProperty(process.stderr, 'isTTY', {
    configurable: true,
    value: true,
  })
  try {
    run()
  } finally {
    if (before) Object.defineProperty(process.stderr, 'isTTY', before)
    else delete (process.stderr as { isTTY?: boolean }).isTTY
  }
}

function captureStderr(run: () => void): string {
  const written: string[] = []
  const spy = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      written.push(String(chunk))
      return true
    })
  try {
    run()
  } finally {
    spy.mockRestore()
  }
  return written.join('')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('supportsColor', () => {
  it('renders color on a terminal with no opt-out', () => {
    withEnv(undefined, () => {
      expect(supportsColor(TERMINAL)).toBe(true)
    })
  })

  it('drops color on a terminal when NO_COLOR carries any value', () => {
    for (const value of ['1', '0', 'false', 'no']) {
      withEnv(value, () => {
        expect(supportsColor(TERMINAL)).toBe(false)
      })
    }
  })

  it('keeps color when NO_COLOR is set but empty', () => {
    withEnv('', () => {
      expect(supportsColor(TERMINAL)).toBe(true)
    })
  })

  it('drops color on a destination that is not a terminal', () => {
    withEnv(undefined, () => {
      expect(supportsColor(PIPE)).toBe(false)
    })
  })

  it('answers each stream on its own', () => {
    withEnv(undefined, () => {
      expect(supportsColor(TERMINAL)).toBe(true)
      expect(supportsColor(PIPE)).toBe(false)
    })
  })
})

describe('palette', () => {
  it('carries escapes for a color-capable destination', () => {
    withEnv(undefined, () => {
      expect(palette(TERMINAL).GREEN).toMatch(SGR)
      expect(palette(TERMINAL).NC).toMatch(SGR)
    })
  })

  it('blanks every entry for a destination that renders none', () => {
    withEnv(undefined, () => {
      expect(Object.values(palette(PIPE))).toEqual(['', '', '', '', '', ''])
    })
  })

  it('reads the environment at call time rather than at import', () => {
    withEnv(undefined, () => {
      expect(supportsColor(TERMINAL)).toBe(true)
    })
    withEnv('1', () => {
      expect(supportsColor(TERMINAL)).toBe(false)
    })
  })
})

describe('the framed writers', () => {
  it('emit no escape to a destination that is not a terminal', () => {
    withEnv(undefined, () => {
      const output = captureStderr(() => {
        intro('Render slides')
        logInfo('done')
        logWarn('careful')
        outro()
      })
      expect(output).not.toMatch(SGR)
    })
  })

  it('keep the frame when the color is gone', () => {
    withEnv(undefined, () => {
      const output = captureStderr(() => {
        intro('Render slides')
        logInfo('done')
        outro()
      })
      expect(output).toContain('┌')
      expect(output).toContain('│')
      expect(output).toContain('└')
      expect(output).toContain('✓')
      expect(output).toContain('Render slides')
    })
  })

  // Without this the fix passes every case above by never emitting at all.
  it('still emit color on a terminal', () => {
    withEnv(undefined, () => {
      asTerminal(() => {
        const output = captureStderr(() => {
          frameSuccess('canon sync', '../my-app')
        })
        expect(output).toMatch(SGR)
      })
    })
  })

  it('honour the opt-out on a terminal', () => {
    withEnv('1', () => {
      asTerminal(() => {
        const output = captureStderr(() => {
          frameSuccess('canon sync', '../my-app')
        })
        expect(output).not.toMatch(SGR)
        expect(output).toContain('canon sync')
      })
    })
  })
})

describe('the help text', () => {
  // The one framed surface written to stdout, so it is the only end-to-end
  // reading of the stream the other writers never touch.
  it('reaches a pipe with no escape in it', () => {
    // The opt-out is unset deliberately, so the pipe is the only thing under
    // test here and an assertion cannot pass on the environment instead.
    const env = { ...process.env }
    delete env.NO_COLOR
    const result = spawnSync('bun', [join(ROOT, 'src/cli.ts')], {
      encoding: 'utf8',
      env,
    })
    expect(result.stdout).toContain('Usage:')
    expect(result.stdout).not.toMatch(SGR)
  })
})

describe('isNonInteractive', () => {
  const saved = {
    canon: process.env.CANON_NON_INTERACTIVE,
    retired: process.env.AITK_NON_INTERACTIVE,
  }

  afterEach(() => {
    restore('CANON_NON_INTERACTIVE', saved.canon)
    restore('AITK_NON_INTERACTIVE', saved.retired)
  })

  function restore(name: string, value: string | undefined): void {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }

  it('should read the current variable', () => {
    process.env.CANON_NON_INTERACTIVE = '1'
    delete process.env.AITK_NON_INTERACTIVE

    expect(isNonInteractive()).toBe(true)
  })

  it('should read the retired variable, which every existing caller still sets', () => {
    delete process.env.CANON_NON_INTERACTIVE
    process.env.AITK_NON_INTERACTIVE = '1'

    expect(isNonInteractive()).toBe(true)
  })

  it('should be false when neither is set', () => {
    delete process.env.CANON_NON_INTERACTIVE
    delete process.env.AITK_NON_INTERACTIVE

    expect(isNonInteractive()).toBe(false)
  })

  it('should be false when the value is not 1', () => {
    process.env.CANON_NON_INTERACTIVE = 'yes'
    delete process.env.AITK_NON_INTERACTIVE

    expect(isNonInteractive()).toBe(false)
  })
})

describe('the source tree', () => {
  // Sixteen copies of one decision is what made color impossible to turn off.
  // A rule nothing enforces rebuilds them the next time a command wants grey.
  it('defines a color escape in the shared module alone', () => {
    const offenders = readdirSync(join(ROOT, 'src'), { recursive: true })
      .map(String)
      .filter((rel) => rel.endsWith('.ts'))
      .filter((rel) => rel !== 'cli/ui.ts' && rel !== 'cli/ui.test.ts')
      .filter((rel) =>
        SGR_LITERAL.test(readFileSync(join(ROOT, 'src', rel), 'utf8')),
      )

    expect(offenders).toEqual([])
  })
})
