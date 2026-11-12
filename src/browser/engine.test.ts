import { describe, expect, it } from 'vitest'
import {
  SANDBOX_FIX,
  isBrowserMissing,
  isEngineMissing,
  isSandboxBlocked,
  sandboxFix,
} from '@/browser/engine'

describe('isSandboxBlocked', () => {
  it("should report Playwright's rewritten box", () => {
    const error = new Error(
      "browserType.launch: Target page, context or browser has been closed\nBrowser logs:\n\nChromium sandboxing failed!\n================================\nTo avoid the sandboxing issue, do either of the following:\n  - (alternative): Launch Chromium without sandbox using 'chromiumSandbox: false' option",
    )

    expect(isSandboxBlocked(error)).toBe(true)
  })

  it("should report Chromium's own line when it reaches the caller unrewritten", () => {
    const error = new Error(
      '[1112/101500.000000:FATAL:zygote_host_impl_linux.cc(128)] No usable sandbox! If you are running on Ubuntu 23.10+',
    )

    expect(isSandboxBlocked(error)).toBe(true)
  })

  it('should not report a launch that failed for any other reason', () => {
    const error = new Error('browserType.launch: Target page crashed')

    expect(isSandboxBlocked(error)).toBe(false)
  })
})

describe('sandboxFix', () => {
  it('should name the sysctl where AppArmor restricts user namespaces', () => {
    expect(sandboxFix('1', 1000)).toBe(SANDBOX_FIX)
  })

  it('should name nothing where the setting is off or absent', () => {
    expect(sandboxFix('0', 1000)).toBeUndefined()
    expect(sandboxFix(undefined, 1000)).toBeUndefined()
  })

  it('should name nothing for root, whom Chromium refuses whatever the setting', () => {
    expect(sandboxFix('1', 0)).toBeUndefined()
  })
})

describe('isBrowserMissing', () => {
  it('should report a binary that was never downloaded', () => {
    const error = new Error(
      "browserType.launch: Executable doesn't exist at /home/x/.cache/ms-playwright/chromium-1200/chrome",
    )

    expect(isBrowserMissing(error)).toBe(true)
  })

  it('should report the install instruction the engine raises on its own', () => {
    const error = new Error(
      'Looks like Playwright was installed or updated. Please run the following command to download new browsers: playwright install',
    )

    expect(isBrowserMissing(error)).toBe(true)
  })

  it('should not report a launch that failed for any other reason', () => {
    const error = new Error('browserType.launch: Target page crashed')

    expect(isBrowserMissing(error)).toBe(false)
  })

  it('should read a thrown value that is not an error', () => {
    expect(isBrowserMissing("Executable doesn't exist at /tmp/chrome")).toBe(
      true,
    )
    expect(isBrowserMissing(undefined)).toBe(false)
  })
})

describe('isEngineMissing', () => {
  it('should report the package failing to resolve', () => {
    expect(isEngineMissing({ code: 'ERR_MODULE_NOT_FOUND' })).toBe(true)
  })

  it('should not report a defect raised from inside the module', () => {
    expect(isEngineMissing(new TypeError('cursors is not a function'))).toBe(
      false,
    )
    expect(isEngineMissing(null)).toBe(false)
  })
})
