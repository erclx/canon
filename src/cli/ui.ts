export interface Palette {
  readonly GREEN: string
  readonly RED: string
  readonly YELLOW: string
  readonly WHITE: string
  readonly GREY: string
  readonly NC: string
}

const COLOR: Palette = {
  GREEN: '\x1b[0;32m',
  RED: '\x1b[0;31m',
  YELLOW: '\x1b[0;33m',
  WHITE: '\x1b[1;37m',
  GREY: '\x1b[0;90m',
  NC: '\x1b[0m',
}

/**
 * The blank palette keeps every frame character and drops only the escapes, so
 * a captured run still reads as one block.
 */
const PLAIN: Palette = {
  GREEN: '',
  RED: '',
  YELLOW: '',
  WHITE: '',
  GREY: '',
  NC: '',
}

/**
 * `NO_COLOR` follows the published convention, where any non-empty value turns
 * color off whatever the value says.
 */
export function supportsColor(stream: { isTTY?: boolean }): boolean {
  const optOut = process.env.NO_COLOR
  if (optOut !== undefined && optOut !== '') return false
  return stream.isTTY === true
}

/**
 * The question is asked per stream rather than once for the process. The framed
 * output goes to stderr and a structured record to stdout, so a run piping only
 * its data keeps a terminal on stderr and keeps its color there. This is a
 * third question again from `isNonInteractive`, which answers whether a caller
 * can be prompted rather than whether a destination renders escapes.
 *
 * Read at write time rather than at import, so nothing freezes an answer taken
 * before the caller's environment was in place.
 */
export function palette(stream: { isTTY?: boolean }): Palette {
  return supportsColor(stream) ? COLOR : PLAIN
}

export function intro(title: string): void {
  const { GREY, NC, WHITE } = palette(process.stderr)
  process.stderr.write(`${GREY}┌${NC}\n${GREY}│${NC} ${WHITE}${title}${NC}\n`)
}

/**
 * Timeline log levels matching `scripts/lib/ui.sh`, so a migrated command
 * prints the same frame as the bash it replaced. All output is stderr,
 * leaving stdout clean for JSON and lists.
 */
export function logInfo(message: string): void {
  const { GREEN, GREY, NC } = palette(process.stderr)
  process.stderr.write(`${GREY}│${NC} ${GREEN}✓${NC} ${message}\n`)
}

export function logWarn(message: string): void {
  const { GREY, NC, YELLOW } = palette(process.stderr)
  process.stderr.write(`${GREY}│${NC} ${YELLOW}!${NC} ${message}\n`)
}

export function logAdd(message: string): void {
  const { GREEN, GREY, NC } = palette(process.stderr)
  process.stderr.write(`${GREY}│${NC} ${GREEN}+${NC} ${message}\n`)
}

export function logRemove(message: string): void {
  const { GREY, NC, RED } = palette(process.stderr)
  process.stderr.write(`${GREY}│${NC} ${RED}-${NC} ${message}\n`)
}

/**
 * Renders the `✗` shape `docs/agents/output-shape.md` specifies for a failure inside an
 * open frame. It does not exit, so the caller closes the frame and returns an
 * exit code rather than terminating mid-write.
 */
export function logError(message: string): void {
  const { GREY, NC, RED } = palette(process.stderr)
  process.stderr.write(`${GREY}│${NC} ${RED}✗${NC} ${message}\n`)
}

export function logStep(message: string): void {
  const { GREY, NC, WHITE } = palette(process.stderr)
  process.stderr.write(`${GREY}│${NC}\n${GREY}├${NC} ${WHITE}${message}${NC}\n`)
}

export function outro(): void {
  const { GREY, NC } = palette(process.stderr)
  process.stderr.write(`${GREY}└${NC}\n`)
}

/**
 * Indents borrowed output inside an open frame, matching `pipe_output` in
 * `scripts/lib/ui.sh`. Used for a document the command did not compose itself,
 * such as a pull request body or the output of a git mutation.
 */
export function pipeOutput(text: string): void {
  const { GREY, NC } = palette(process.stderr)
  const lines = text.replace(/\n$/, '').split('\n')
  process.stderr.write(
    `${lines.map((line) => `${GREY}│${NC}  ${line}`).join('\n')}\n`,
  )
}

/** Counts a noun for a report line, where the plural is the bare `s` form. */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

export function frameError(message: string): void {
  const { GREY, NC, RED } = palette(process.stderr)
  process.stderr.write(
    `${GREY}┌${NC}\n${GREY}│${NC} ${RED}✗${NC} ${message}\n${GREY}└${NC}\n`,
  )
}

export function frameSuccess(command: string, target: string): void {
  const { GREEN, GREY, NC, WHITE } = palette(process.stderr)
  process.stderr.write(
    `${GREY}┌${NC}\n${GREY}│${NC} ${WHITE}${command}${NC}\n${GREY}│${NC}\n${GREY}│${NC} ${GREEN}✓${NC} ${target}\n${GREY}└${NC}\n`,
  )
}

/**
 * The retired spelling is still honored, and permanently.
 *
 * This variable is the documented way to drive any command headlessly, so
 * every skill body, CI job, and operator script already written sets the old
 * name. Those callers live in other repositories and in plugin caches this
 * release cannot reach, and the failure mode of dropping the fallback is a
 * command that quietly waits for a TTY nobody is watching rather than one that
 * refuses and says why.
 */
export function isNonInteractive(): boolean {
  return (
    process.env.CANON_NON_INTERACTIVE === '1' ||
    // canon-keep-retired
    process.env.AITK_NON_INTERACTIVE === '1'
  )
}

/**
 * `nonInteractiveDefault` opts a prompt into the `select_option` behavior from
 * `scripts/lib/ui.sh`, where `CANON_NON_INTERACTIVE=1` resolves to the first
 * option instead of failing. Callers that would rather fail loudly than pick
 * for the user leave it off.
 */
export async function select<Value>(opts: {
  message: string
  options: { value: Value; label: string; hint?: string }[]
  nonInteractiveDefault?: boolean
}): Promise<Value> {
  const { message, options } = opts
  const { GREEN, GREY, NC, RED, WHITE } = palette(process.stderr)
  const count = options.length
  let cursor = 0

  if (opts.nonInteractiveDefault && isNonInteractive()) {
    process.stderr.write(
      `${GREY}│${NC}\n${GREY}◇${NC} ${message} ${WHITE}${options[0].label}${NC}\n`,
    )
    return options[0].value
  }

  const render = (): void => {
    let out = `${GREY}│${NC}\n${GREEN}◆${NC} ${message}\n`
    for (let i = 0; i < count; i++) {
      const label = options[i].label
      const hint = options[i].hint ? ` ${GREY}${options[i].hint}${NC}` : ''
      if (i === cursor) {
        out += `${GREY}│${NC}  ${GREEN}❯ ${label}${NC}${hint}\n`
      } else {
        out += `${GREY}│${NC}    ${GREY}${label}${NC}${hint}\n`
      }
    }
    process.stderr.write(out)
  }

  const clear = (): void => {
    process.stderr.write(`\x1b[${count + 2}A\x1b[J`)
  }

  return new Promise<Value>((resolve) => {
    if (!process.stdin.isTTY) {
      process.stderr.write(
        `${GREY}│${NC} ${RED}✗${NC} ${message} requires a TTY. Pass an argument or set CANON_NON_INTERACTIVE=1.\n${GREY}└${NC}\n`,
      )
      process.exit(1)
    }

    const wasRaw = process.stdin.isRaw
    process.stdin.setRawMode(true)
    process.stdin.resume()

    render()

    const onData = (data: Buffer): void => {
      const key = data.toString()

      if (key === '\x1b[A' || key === 'k') {
        cursor = (cursor - 1 + count) % count
        clear()
        render()
      } else if (key === '\x1b[B' || key === 'j') {
        cursor = (cursor + 1) % count
        clear()
        render()
      } else if (key === '\r' || key === '\n') {
        cleanup()
        clear()
        process.stderr.write(
          `${GREY}│${NC}\n${GREY}◇${NC} ${message} ${WHITE}${options[cursor].label}${NC}\n`,
        )
        resolve(options[cursor].value)
      } else if (key === '\x1b' || key === 'q' || key === '\x03') {
        cleanup()
        clear()
        process.stderr.write(
          `${GREY}│${NC}\n${GREY}◇${NC} ${message} ${RED}Cancelled${NC}\n${GREY}└${NC}\n`,
        )
        process.exit(1)
      }
    }

    const cleanup = (): void => {
      process.stdin.removeListener('data', onData)
      process.stdin.setRawMode(wasRaw ?? false)
      process.stdin.pause()
    }

    process.stdin.on('data', onData)
  })
}

export async function confirm(opts: {
  message: string
  active?: string
  inactive?: string
}): Promise<boolean> {
  const active = opts.active ?? 'Yes'
  const inactive = opts.inactive ?? 'No'

  const result = await select({
    message: opts.message,
    options: [
      { value: true, label: active },
      { value: false, label: inactive },
    ],
  })

  return result
}
