/**
 * What every browser-driving command needs to report a failure honestly: how
 * each of the engine's two absences reads when thrown, the sandbox policy every
 * launch asks for, and the press that decides whether a focus reading means anything.
 */

import { readFileSync } from 'node:fs'

/** Fetches the browser revision the pinned engine expects. */
export const INSTALL_BROWSER = 'bunx playwright install chromium'

/**
 * Separates a browser binary that was never installed, a setup step the operator
 * runs, from every other launch failure, which is a defect.
 */
export function isBrowserMissing(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error)
  return /executable doesn't exist|playwright install/i.test(text)
}

/**
 * Reports the engine package failing to resolve, which a target hits before
 * installing it. Any other import failure is a defect and propagates.
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
 * Separates a server nobody started from a page that failed for its own reasons,
 * since reporting the first as an empty reading says the site gives no answers
 * when nothing was ever asked.
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
 * Puts the page in keyboard modality, the precondition for reading a
 * `:focus-visible` rule, since a scripted `.focus()` alone leaves pointer
 * modality where that rule does not match. One press covers the page and survives the next blur.
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
 * Playwright replaces the browser's log on that failure, so the `zygote_host_impl_linux.cc` line covers an unrewritten one.
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
 * The fix a `sandbox-blocked` refusal carries, set only when the setting reads 1
 * and the process is not root. Elsewhere the sysctl changes nothing, so naming it
 * would send the operator to the wrong cause.
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
