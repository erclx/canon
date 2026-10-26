import { type ChildProcess, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * Launches chrome-headless-shell under begin-frame control and speaks raw CDP
 * to one page in it. Playwright cannot ask for begin-frame control on a page it
 * opens, and only the headless shell honors the flag, so this bypasses the
 * engine and finds the shell Playwright installed beside Chromium.
 *
 * `playwright-core` exposes no path for the shell, so the path is rebuilt from
 * its `browsers.json` revision and its cache layout. A Playwright upgrade that
 * moves that layout surfaces here as `browser-missing` rather than as a crash.
 */

export class ShellMissing extends Error {}

/** Each platform's folder and binary inside the shell's revision folder. */
const SHELL_DIRS: Record<string, readonly [string, string]> = {
  'linux-x64': ['chrome-headless-shell-linux64', 'chrome-headless-shell'],
  'linux-arm64': ['chrome-headless-shell-linux-arm64', 'chrome-headless-shell'],
  'darwin-x64': ['chrome-headless-shell-mac-x64', 'chrome-headless-shell'],
  'darwin-arm64': ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell'],
}

const FLAGS = [
  '--enable-begin-frame-control',
  '--run-all-compositor-stages-before-draw',
  '--disable-threaded-animation',
  '--disable-threaded-scrolling',
  '--disable-checker-imaging',
  '--hide-scrollbars',
  '--force-device-scale-factor=2',
  '--mute-audio',
  '--no-first-run',
]

/** Resolves the installed shell, throwing `ShellMissing` naming where it looked. */
export function findShell(env: NodeJS.ProcessEnv = process.env): string {
  const require = createRequire(import.meta.url)
  const engineRoot = dirname(require.resolve('playwright-core/package.json'))
  const manifest = JSON.parse(
    readFileSync(join(engineRoot, 'browsers.json'), 'utf8'),
  ) as { browsers: { name: string; revision: string }[] }
  const revision = manifest.browsers.find(
    (browser) => browser.name === 'chromium-headless-shell',
  )?.revision
  const dirs = SHELL_DIRS[`${process.platform}-${process.arch}`]
  if (!revision || !dirs) {
    throw new ShellMissing(
      `no chrome-headless-shell for ${process.platform}-${process.arch} in playwright-core's browsers.json`,
    )
  }

  const path = join(
    registryRoot(env, engineRoot),
    `chromium_headless_shell-${revision}`,
    ...dirs,
  )
  if (!existsSync(path)) {
    throw new ShellMissing(
      `chrome-headless-shell executable doesn't exist at ${path}`,
    )
  }
  return path
}

/** Where Playwright keeps its browsers, read the way its own registry reads it. */
function registryRoot(env: NodeJS.ProcessEnv, engineRoot: string): string {
  const pinned = env.PLAYWRIGHT_BROWSERS_PATH
  if (pinned === '0') return join(engineRoot, '.local-browsers')
  if (pinned) return pinned
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Caches', 'ms-playwright')
  }
  return join(env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'ms-playwright')
}

type Listener = (params: Record<string, unknown>) => void

export interface ShellPage {
  send<T = Record<string, unknown>>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<T>
  /** Calls `listener` on every event of `method` from this page. */
  on(method: string, listener: Listener): void
  /** Runs an expression in the page and returns its value. */
  evaluate<T>(expression: string): Promise<T>
  /** Kills the shell and removes its profile, safe to call more than once. */
  close(): void
}

/**
 * Opens one page at `width` by `height` with begin-frame control. The launch
 * owns its profile folder and kills the shell on process exit, so a killed take
 * leaves no shell running and no profile behind.
 */
export async function openShell(
  executable: string,
  size: { readonly width: number; readonly height: number },
): Promise<ShellPage> {
  const profile = mkdtempSync(join(tmpdir(), 'canon-take-'))
  const proc = spawn(
    executable,
    [
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      ...FLAGS,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  )

  let closed = false
  const close = (): void => {
    if (closed) return
    closed = true
    process.off('exit', close)
    process.off('SIGINT', interrupt)
    process.off('SIGTERM', interrupt)
    socket?.close()
    proc.kill('SIGKILL')
    rmSync(profile, { recursive: true, force: true })
  }
  // A signal skips the exit event, so it closes the shell and then re-raises
  // itself with the default handler restored, ending the process as it would have.
  const interrupt = (signal: NodeJS.Signals): void => {
    close()
    process.kill(process.pid, signal)
  }
  process.on('exit', close)
  process.once('SIGINT', interrupt)
  process.once('SIGTERM', interrupt)

  let socket: WebSocket | undefined
  try {
    socket = new WebSocket(await devtoolsUrl(proc))
    await new Promise((done, fail) => {
      socket?.addEventListener('open', done, { once: true })
      socket?.addEventListener('error', fail, { once: true })
    })
    return await attach(socket, size, close)
  } catch (error) {
    close()
    throw error
  }
}

function devtoolsUrl(proc: ChildProcess): Promise<string> {
  return new Promise((done, fail) => {
    let output = ''
    proc.stderr?.on('data', (chunk: Buffer) => {
      output += chunk.toString()
      const match = output.match(/DevTools listening on (ws:\S+)/)
      if (match?.[1]) done(match[1])
    })
    proc.on('error', fail)
    proc.on('exit', (code) =>
      fail(new Error(`the shell exited ${code}: ${output.slice(-400)}`)),
    )
  })
}

async function attach(
  socket: WebSocket,
  size: { readonly width: number; readonly height: number },
  close: () => void,
): Promise<ShellPage> {
  let nextId = 0
  const pending = new Map<
    number,
    { resolve: (value: never) => void; reject: (error: Error) => void }
  >()
  const listeners: { method: string; sessionId: string; listener: Listener }[] =
    []

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data)) as {
      id?: number
      method?: string
      sessionId?: string
      params?: Record<string, unknown>
      result?: never
      error?: { message: string; data?: string }
    }
    if (message.id !== undefined) {
      const waiter = pending.get(message.id)
      if (!waiter) return
      pending.delete(message.id)
      if (message.error) {
        waiter.reject(
          new Error(
            `${message.error.message} ${message.error.data ?? ''}`.trim(),
          ),
        )
      } else {
        waiter.resolve(message.result as never)
      }
      return
    }
    for (const entry of listeners) {
      if (
        entry.method === message.method &&
        entry.sessionId === message.sessionId
      ) {
        entry.listener(message.params ?? {})
      }
    }
  })
  socket.addEventListener('close', () => {
    for (const waiter of pending.values()) {
      waiter.reject(new Error('the shell closed its connection'))
    }
    pending.clear()
  })

  const raw = <T>(
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string,
  ): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      nextId += 1
      pending.set(nextId, {
        resolve: resolve as (value: never) => void,
        reject,
      })
      socket.send(
        JSON.stringify({
          id: nextId,
          method,
          params,
          ...(sessionId ? { sessionId } : {}),
        }),
      )
    })

  const { browserContextId } = await raw<{ browserContextId: string }>(
    'Target.createBrowserContext',
  )
  const { targetId } = await raw<{ targetId: string }>('Target.createTarget', {
    url: 'about:blank',
    browserContextId,
    enableBeginFrameControl: true,
    width: size.width,
    height: size.height,
  })
  const { sessionId } = await raw<{ sessionId: string }>(
    'Target.attachToTarget',
    { targetId, flatten: true },
  )

  const send = <T>(method: string, params?: Record<string, unknown>) =>
    raw<T>(method, params, sessionId)

  await send('Page.enable')
  await send('Runtime.enable')

  return {
    send,
    on: (method, listener) => listeners.push({ method, sessionId, listener }),
    evaluate: async <T>(expression: string): Promise<T> => {
      const reply = await send<{
        result: { value: T }
        exceptionDetails?: {
          text: string
          exception?: { description?: string }
        }
      }>('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })
      if (reply.exceptionDetails) {
        throw new Error(
          reply.exceptionDetails.exception?.description ??
            reply.exceptionDetails.text,
        )
      }
      return reply.result.value
    },
    close,
  }
}
