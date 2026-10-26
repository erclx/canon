/**
 * The pinned agent browser CLI every skill driving a page reaches through
 * `canon browser`, so every call in a run and every run on a machine reach one
 * version. `open` is forced onto the bundled Chromium, since the CLI's default
 * channel is a branded Chrome most machines lack, and it refuses rather than
 * downloading when that browser is absent, since a dispatched reviewer that
 * installs mid-pass spends its budget on the download.
 */

export const AGENT_CLI = '@playwright/cli@0.1.22'

/**
 * The Chromium revision that CLI version requires. It moves with the pin, and
 * it is separate from the revision `INSTALL_BROWSER` fetches for the engine.
 */
export const CHROMIUM_REVISION = '1247'

export const INSTALL_AGENT_BROWSER = 'canon browser install-browser chromium'

export type AgentCall =
  | { readonly kind: 'run'; readonly args: readonly string[] }
  | { readonly kind: 'refused'; readonly message: string }

/**
 * Rewrites the caller's words into the child's, reading the revision only for
 * `open`, the one verb that launches a browser. Global flags may lead the verb,
 * as in `-s=<name> --raw open <url>`.
 */
export function planAgentCall(
  args: readonly string[],
  hasRevision: () => boolean,
): AgentCall {
  const verbAt = args.findIndex((arg) => !arg.startsWith('-'))
  if (verbAt === -1 || args[verbAt] !== 'open') return { kind: 'run', args }

  if (!hasRevision()) {
    return {
      kind: 'refused',
      message: `Chromium revision ${CHROMIUM_REVISION} is not installed. Run once, outside the pass: ${INSTALL_AGENT_BROWSER}`,
    }
  }

  const namesBrowser = args.some(
    (arg) => arg === '--browser' || arg.startsWith('--browser='),
  )
  if (namesBrowser) return { kind: 'run', args }

  return {
    kind: 'run',
    args: [
      ...args.slice(0, verbAt + 1),
      '--browser=chromium',
      ...args.slice(verbAt + 1),
    ],
  }
}

/** Where Playwright keeps downloaded browsers, by its own lookup order. */
export function browsersRoot(
  env: Readonly<Record<string, string | undefined>>,
  platform: string,
  home: string,
): string {
  const override = env.PLAYWRIGHT_BROWSERS_PATH
  if (override !== undefined && override !== '') return override
  if (platform === 'darwin') return `${home}/Library/Caches/ms-playwright`
  return `${home}/.cache/ms-playwright`
}
