import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ShellSandboxBlocked, openShell } from '@/take/shell'

/**
 * Launches fake shells, so the refusal is proved with no AppArmor and no
 * browser. The fatal line is Chromium's own, from `zygote_host_impl_linux.cc`.
 */

const SIZE = { width: 800, height: 600 }

const SANDBOX_FATAL =
  '[1112/101500.000000:FATAL:zygote_host_impl_linux.cc(128)] No usable sandbox! If you are running on Ubuntu 23.10+ or another Linux distro that has disabled unprivileged user namespaces with AppArmor, see the guide.'

describe('openShell', () => {
  let dir: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'canon-shell-'))
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function fake(name: string, body: string): string {
    const path = join(dir, name)
    writeFileSync(path, `#!/bin/sh\n${body}\n`)
    chmodSync(path, 0o755)
    return path
  }

  it('should refuse as sandbox-blocked when the shell dies on the sandbox fatal', async () => {
    const shell = fake(
      'sandboxed',
      `echo '${SANDBOX_FATAL}' >&2\nkill -TRAP $$`,
    )

    const launch = openShell(shell, SIZE)

    await expect(launch).rejects.toBeInstanceOf(ShellSandboxBlocked)
    await expect(launch).rejects.toThrow(shell)
  })

  it('should read the marker when it arrives split across two writes', async () => {
    const shell = fake(
      'split',
      `printf 'FATAL: No usable ' >&2\nsleep 0.1\necho 'sandbox!' >&2\nkill -TRAP $$`,
    )

    await expect(openShell(shell, SIZE)).rejects.toBeInstanceOf(
      ShellSandboxBlocked,
    )
  })

  it('should name the code and the last line when the shell exits otherwise', async () => {
    const shell = fake(
      'broken',
      `echo 'starting' >&2\necho 'error while loading shared libraries: libnss3.so' >&2\nexit 1`,
    )

    const launch = openShell(shell, SIZE)

    await expect(launch).rejects.not.toBeInstanceOf(ShellSandboxBlocked)
    await expect(launch).rejects.toThrow(
      'the shell exited with 1: error while loading shared libraries: libnss3.so',
    )
  })

  it('should name the signal and keep the fatal line when a signal ends the shell', async () => {
    const shell = fake(
      'aborted',
      `echo '[1:FATAL:gpu_init.cc(1)] GPU died' >&2\necho 'trailing noise' >&2\nkill -TRAP $$`,
    )

    await expect(openShell(shell, SIZE)).rejects.toThrow(
      'the shell exited on SIGTRAP: [1:FATAL:gpu_init.cc(1)] GPU died',
    )
  })
})
