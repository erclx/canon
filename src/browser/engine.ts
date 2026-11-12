/**
 * What every browser-driving command needs to know before it can report a
 * failure honestly: how the binary is installed, how each of the two ways it
 * can be absent reads when it is thrown, and the one press that decides whether
 * a focus reading means anything.
 *
 * The two absences are different states with different remedies. A package that
 * never resolved means the target installed the CLI without the engine, and a
 * binary that was never downloaded means the engine is present and its browser
 * is not. Every command driving a browser reads both, so they sit here rather
 * than beside one caller.
 *
 * The sandbox policy sits here for the same reason. Every product launch asks
 * for it, and every refusal reading a blocked start names the same fix.
 */

import { readFileSync } from 'node:fs'

/** Fetches the browser revision the pinned engine expects. */
export const INSTALL_BROWSER = 'bunx playwright install chromium'

/**
 * Separates a browser binary that was never installed from every other launch
 * failure, because the first is a setup step the operator has to run and the
 * second is a defect. A target inherits that setup step, which is the stated
 * cost of shipping a browser command outside the toolkit.
 */
export function isBrowserMissing(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error)
  return /executable doesn't exist|playwright install/i.test(text)
}

/**
 * Reports the engine package failing to resolve, which is the case a target
 * hits before installing it. Any other import failure is a defect inside the
 * module being loaded and propagates, rather than being reported as a missing
 * dependency.
 */
export function isEngineMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ERR_MODULE_NOT_FOUND'
  )
}

/**
 * Separates a server nobody started from a page that failed for its own
 * reasons. The first is a precondition no browser command can create for
 * itself, and reporting it as an empty reading says the site gives no answers
 * when nothing was ever asked.
 *
 * It moved here alongside the modality press, when `@/driver/drive` became the
 * second module needing it.
 */
export function isServerUnreachable(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error)
  return /ERR_CONNECTION_REFUSED|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_RESET|ERR_EMPTY_RESPONSE/i.test(
    text,
  )
}

/**
 * The narrowest shape the press below needs, declared here rather than imported
 * as `Page`, so this module keeps its type surface free of the engine and every
 * command reading a refusal string still loads without resolving it.
 */
export interface KeyboardPage {
  readonly keyboard: { press(key: string): Promise<void> }
}

/**
 * Puts the page in keyboard modality, which is the precondition for reading a
 * `:focus-visible` rule at all. A scripted `.focus()` on its own leaves the
 * browser in pointer modality, where that rule does not match, so a reader
 * calling it alone reports every correctly styled element as unstyled.
 *
 * It moved here when `@/driver/probes/focus` became the second call site. One press
 * covers the page rather than the element that happens to hold focus, so it
 * survives the blur every reader takes next.
 */
export async function enterKeyboardModality(page: KeyboardPage): Promise<void> {
  await page.keyboard.press('Tab')
}

/**
 * Spread into every product launch, since Playwright passes `--no-sandbox`
 * whenever `chromiumSandbox` is not `true`, on every platform. A launch that
 * opens an outside page without it leaves a renderer exploit unconfined.
 */
export const SANDBOXED = { chromiumSandbox: true } as const

/**
 * Reports a launch that died because the kernel refused Chromium its sandbox.
 * Playwright replaces the browser's log with its own box on that failure, and
 * Chromium's line from `zygote_host_impl_linux.cc` covers a log that reached
 * the caller unrewritten.
 */
export function isSandboxBlocked(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error)
  return /Chromium sandboxing failed!|No usable sandbox!/.test(text)
}

export const USERNS_SETTING = 'kernel.apparmor_restrict_unprivileged_userns'
const USERNS_FILE = '/proc/sys/kernel/apparmor_restrict_unprivileged_userns'

/** Clears a blocked sandbox for this boot where AppArmor is what blocks it. */
export const SANDBOX_FIX = `sudo sysctl -w ${USERNS_SETTING}=0`

/** The AppArmor setting as this kernel reads it, absent where it has none. */
export function readUsernsSetting(): string | undefined {
  try {
    return readFileSync(USERNS_FILE, 'utf8').trim()
  } catch {
    return undefined
  }
}

/**
 * The fix a `sandbox-blocked` refusal carries, set only when the setting reads
 * 1 and the process is not root. Anywhere else the sysctl changes nothing, as
 * under a container's seccomp profile or for root, which Chromium refuses a
 * sandbox outright, and naming it would send the operator to the wrong cause.
 */
export function sandboxFix(
  setting: string | undefined,
  uid: number | undefined,
): string | undefined {
  return setting === '1' && uid !== 0 ? SANDBOX_FIX : undefined
}

/** `sandboxFix` read off this machine and this process. */
export function launchSandboxFix(): string | undefined {
  return sandboxFix(readUsernsSetting(), process.getuid?.())
}
