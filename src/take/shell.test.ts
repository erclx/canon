import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ShellSandboxBlocked, openShell, sandboxBlocked } from '@/take/shell'

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

  it.each([
    ['at scale 1 when asked', { deviceScale: 1 as const }, 1],
    ['at scale 2 when no scale is given', {}, 2],
  ])('should launch %s', async (_, options, scale) => {
    const argv = join(dir, `argv-${scale}-${Object.keys(options).length}`)
    const shell = fake(`scaled-${scale}`, `echo "$@" > ${argv}\nexit 1`)

    await expect(openShell(shell, SIZE, options)).rejects.toThrow()

    const flags = readFileSync(argv, 'utf8')
    expect(flags).toContain(`--force-device-scale-factor=${scale} `)
    expect(flags.match(/--force-device-scale-factor/g)).toHaveLength(1)
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

describe('sandboxBlocked', () => {
  it('should carry the sysctl as its fix when the AppArmor setting reads 1', () => {
    const refusal = sandboxBlocked('/opt/shell', '1')

    expect(refusal.fix).toBe(
      'sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0',
    )
    expect(refusal.message).toContain('/opt/shell')
  })

  it.each([
    ['0', 'is 0'],
    [undefined, 'carries no kernel.apparmor_restrict_unprivileged_userns'],
  ])(
    'should carry no fix and keep the guide when the setting reads %s',
    (setting, reading) => {
      const refusal = sandboxBlocked('/opt/shell', setting)

      expect(refusal.fix).toBeUndefined()
      expect(refusal.message).toContain(reading)
      expect(refusal.message).not.toContain('sysctl -w')
      expect(refusal.message).toContain('apparmor-userns-restrictions.md')
    },
  )
})
