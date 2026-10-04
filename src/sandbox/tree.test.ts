import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  assertSandboxDirSafe,
  mintSandboxRunId,
  normalizeSandboxPath,
  sandboxTree,
} from '@/sandbox/tree'

const SAVED = {
  CANON_SANDBOX_DIR: process.env.CANON_SANDBOX_DIR,
  CANON_SANDBOX_RUN_ID: process.env.CANON_SANDBOX_RUN_ID,
  XDG_STATE_HOME: process.env.XDG_STATE_HOME,
}

function restore(key: keyof typeof SAVED): void {
  const value = SAVED[key]
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}

beforeEach(() => {
  delete process.env.CANON_SANDBOX_DIR
  delete process.env.CANON_SANDBOX_RUN_ID
  process.env.XDG_STATE_HOME = '/xdg'
})

afterEach(() => {
  restore('CANON_SANDBOX_DIR')
  restore('CANON_SANDBOX_RUN_ID')
  restore('XDG_STATE_HOME')
})

describe('sandboxTree', () => {
  it('should prefer the explicit override over the per-run default', () => {
    process.env.CANON_SANDBOX_DIR = '/explicit'

    expect(sandboxTree()).toBe('/explicit')
  })

  it('should give two independent processes two different trees', () => {
    const first = sandboxTree()
    delete process.env.CANON_SANDBOX_RUN_ID

    const second = sandboxTree()

    expect(first).not.toBe(second)
  })

  it('should give the same tree to two calls sharing one run id', () => {
    const first = sandboxTree()

    const second = sandboxTree()

    expect(second).toBe(first)
  })

  it('should give the same tree to a call that inherits an already-minted run id', () => {
    process.env.CANON_SANDBOX_RUN_ID = 'inherited-id'

    expect(sandboxTree()).toBe('/xdg/canon/sandbox-inherited-id')
  })
})

describe('mintSandboxRunId', () => {
  it('should reuse an id a parent process already exported', () => {
    process.env.CANON_SANDBOX_RUN_ID = 'from-parent'

    expect(mintSandboxRunId()).toBe('from-parent')
  })

  it('should mint once and hold the same id across repeated calls', () => {
    const first = mintSandboxRunId()

    expect(mintSandboxRunId()).toBe(first)
    expect(process.env.CANON_SANDBOX_RUN_ID).toBe(first)
  })
})

describe('normalizeSandboxPath', () => {
  it('should collapse repeated separators and strip trailing ones', () => {
    expect(normalizeSandboxPath('//home//me///sandbox//')).toBe(
      '/home/me/sandbox',
    )
  })

  it('should fold dot segments within the path', () => {
    expect(normalizeSandboxPath('/home/me/./a/../b')).toBe('/home/me/b')
  })

  it('should clamp a climb past the root at the root', () => {
    expect(normalizeSandboxPath('/home/../../..')).toBe('/')
  })

  it('should keep the leading climbs of a relative path', () => {
    expect(normalizeSandboxPath('../../a/./b/..')).toBe('../../a')
  })
})

describe('assertSandboxDirSafe', () => {
  const where = { home: '/home/me', temp: '/tmp', mainRoot: '/home/me/repo' }

  it('should accept a strict descendant of the home folder outside the repository', () => {
    expect(
      assertSandboxDirSafe('/home/me/.local/state/canon/sandbox-1', where),
    ).toBeUndefined()
  })

  it('should refuse a relative path', () => {
    expect(assertSandboxDirSafe('sandbox', where)).toBe(
      'CANON_SANDBOX_DIR must be an absolute path, got: sandbox',
    )
  })

  it('should refuse the home folder itself', () => {
    expect(assertSandboxDirSafe('/home/me/', where)).toBe(
      'Refusing /home/me/ as the sandbox. Provisioning removes the tree first, so the path has to sit under /home/me rather than be it.',
    )
  })

  it('should refuse a path outside the home and temp roots', () => {
    expect(assertSandboxDirSafe('/usr', where)).toBe(
      'Refusing /usr as the sandbox. Provisioning removes the tree first, so the path has to sit under /home/me or /tmp.',
    )
  })

  it('should refuse a path at or above the project root, naming what it resolves to', () => {
    expect(assertSandboxDirSafe('/home/me/repo/sub/..', where)).toBe(
      'Refusing /home/me/repo/sub/.. as the sandbox. Provisioning removes the tree first, and that path contains /home/me/repo. It resolves to /home/me/repo.',
    )
  })

  it('should refuse a path inside the project root', () => {
    expect(assertSandboxDirSafe('/home/me/repo/tree', where)).toBe(
      'Sandbox at /home/me/repo/tree sits inside /home/me/repo, which puts the toolkit CLAUDE.md back on the session ancestor chain. Point CANON_SANDBOX_DIR outside the repository.',
    )
  })
})
