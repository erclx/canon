import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  frameError,
  frameSuccess,
  intro,
  isNonInteractive,
  logAdd,
  logError,
  logInfo,
  logRemove,
  logStep,
  logWarn,
  outro,
  outroSuccess,
  palette,
  pipeOutput,
  select,
  setQuiet,
  supportsColor,
} from '@/cli/ui'

const ROOT = join(import.meta.dirname, '../..')

/** Any SGR sequence. The cursor and key sequences end in a letter instead. */
// oxlint-disable-next-line no-control-regex
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

  it('keep the frame on a terminal when the color is gone', () => {
    withEnv('1', () => {
      asTerminal(() => {
        const output = captureStderr(() => {
          intro('Render slides')
          logInfo('done')
          outro()
        })
        expect(output).toBe('┌\n│ Render slides\n│ ✓ done\n└\n')
      })
    })
  })

  it('write plain marked lines to a destination that is not a terminal', () => {
    const output = captureStderr(() => {
      intro('Render slides')
      logStep('Reading rules')
      logInfo('done')
      logAdd('added.md')
      logRemove('gone.md')
      logWarn('careful')
      logError('broke')
      pipeOutput('body\n')
      outro()
    })
    expect(output).toBe(
      'Render slides\nReading rules\n✓ done\n+ added.md\n- gone.md\n! careful\n✗ broke\n  body\n',
    )
  })

  it('write a framed error as one plain line off a terminal', () => {
    const output = captureStderr(() => {
      frameError('no plan')
    })
    expect(output).toBe('✗ no plan\n')
  })
})

describe('quiet mode', () => {
  afterEach(() => {
    setQuiet(false)
  })

  it('writes no progress', () => {
    setQuiet(true)
    const output = captureStderr(() => {
      intro('Render slides')
      logStep('Reading rules')
      logInfo('done')
      logAdd('added.md')
      logRemove('gone.md')
      pipeOutput('body')
      frameSuccess('canon sync', '../my-app')
      outroSuccess('Sync complete')
    })
    expect(output).toBe('')
  })

  // Diagnostics reach stderr in every mode, so a quiet run that hides a
  // failure is the regression this guards.
  it('still writes warnings and errors', () => {
    setQuiet(true)
    const output = captureStderr(() => {
      logWarn('careful')
      logError('broke')
      frameError('no plan')
    })
    expect(output).toBe('! careful\n✗ broke\n✗ no plan\n')
  })
})

describe('a --json run', () => {
  // The switch is set from the parsed command, so only a real run reads the
  // wiring rather than the helper.
  it('writes its record and no progress, leaving warnings to stderr', () => {
    const result = spawnSync(
      'bun',
      [
        join(ROOT, 'src/cli.ts'),
        'markdown',
        'audit',
        join(ROOT, 'canon/REQUIREMENTS.md'),
        '--json',
      ],
      { encoding: 'utf8' },
    )
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toBeTypeOf('object')
    expect(result.stderr).not.toContain('canon markdown audit')
    expect(result.stderr).not.toContain('✓')
  })

  it('leaves the progress on for a text run of the same verb', () => {
    const result = spawnSync(
      'bun',
      [
        join(ROOT, 'src/cli.ts'),
        'markdown',
        'audit',
        join(ROOT, 'canon/REQUIREMENTS.md'),
      ],
      { encoding: 'utf8' },
    )
    expect(result.stderr).toContain('✓ 1 markdown file')
  })
})

describe('outroSuccess', () => {
  it('closes the frame above the success line on a terminal', () => {
    withEnv('1', () => {
      asTerminal(() => {
        const output = captureStderr(() => {
          outroSuccess('Sync complete', '(3 rules)')
        })
        expect(output).toBe('└\n✓ Sync complete (3 rules)\n')
      })
    })
  })

  it('writes the success line alone off a terminal', () => {
    const output = captureStderr(() => {
      outroSuccess('Rules installed')
    })
    expect(output).toBe('✓ Rules installed\n')
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
    stdin: Object.getOwnPropertyDescriptor(process.stdin, 'isTTY'),
  }

  afterEach(() => {
    restore('CANON_NON_INTERACTIVE', saved.canon)
    restore('AITK_NON_INTERACTIVE', saved.retired)
    if (saved.stdin) Object.defineProperty(process.stdin, 'isTTY', saved.stdin)
    else delete (process.stdin as { isTTY?: boolean }).isTTY
  })

  function restore(name: string, value: string | undefined): void {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }

  /** The runner's own stdin varies by host, so every case pins it. */
  function stdinIs(isTTY: boolean | undefined): void {
    delete process.env.CANON_NON_INTERACTIVE
    delete process.env.AITK_NON_INTERACTIVE
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: isTTY,
    })
  }

  it('should be headless when stdin is not a terminal and nothing is set', () => {
    stdinIs(undefined)

    expect(isNonInteractive()).toBe(true)
  })

  it('should be interactive when stdin is a terminal and nothing is set', () => {
    stdinIs(true)

    expect(isNonInteractive()).toBe(false)
  })

  it('should let the current variable force headless on a terminal', () => {
    stdinIs(true)
    process.env.CANON_NON_INTERACTIVE = '1'

    expect(isNonInteractive()).toBe(true)
  })

  it('should let the retired variable, which plugin caches still set, force headless', () => {
    stdinIs(true)
    process.env.AITK_NON_INTERACTIVE = '1'

    expect(isNonInteractive()).toBe(true)
  })

  it('should ignore a value other than 1 on a terminal', () => {
    stdinIs(true)
    process.env.CANON_NON_INTERACTIVE = 'yes'

    expect(isNonInteractive()).toBe(false)
  })

  describe('select with no terminal', () => {
    const options = [
      { value: 'first', label: 'First' },
      { value: 'second', label: 'Second' },
    ]

    it('should take the first option when the prompt opts in', async () => {
      stdinIs(undefined)
      const written: string[] = []
      const spy = vi
        .spyOn(process.stderr, 'write')
        .mockImplementation((chunk: string | Uint8Array) => {
          written.push(String(chunk))
          return true
        })

      try {
        await expect(
          select({ message: 'Pick', options, nonInteractiveDefault: true }),
        ).resolves.toBe('first')
      } finally {
        spy.mockRestore()
      }

      expect(written.join('')).toBe('◇ Pick First\n')
    })

    it('should write nothing for the default under a quiet run', async () => {
      stdinIs(undefined)
      setQuiet(true)
      const written: string[] = []
      const spy = vi
        .spyOn(process.stderr, 'write')
        .mockImplementation((chunk: string | Uint8Array) => {
          written.push(String(chunk))
          return true
        })

      try {
        await expect(
          select({ message: 'Pick', options, nonInteractiveDefault: true }),
        ).resolves.toBe('first')
      } finally {
        spy.mockRestore()
        setQuiet(false)
      }

      expect(written).toEqual([])
    })

    it('should refuse with a bare mark naming the hint and never the variable', async () => {
      stdinIs(undefined)
      const written: string[] = []
      const write = vi
        .spyOn(process.stderr, 'write')
        .mockImplementation((chunk: string | Uint8Array) => {
          written.push(String(chunk))
          return true
        })
      const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit')
      })

      let codes: unknown[][] = []
      try {
        await expect(
          select({ message: 'Pick', options, ttyHint: 'Pass --stack' }),
        ).rejects.toThrow('exit')
        codes = [...exit.mock.calls]
      } finally {
        write.mockRestore()
        exit.mockRestore()
      }

      const out = written.join('')
      expect(out).toBe('✗ Pick requires a TTY. Pass --stack.\n')
      expect(codes).toEqual([[1]])
    })
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
