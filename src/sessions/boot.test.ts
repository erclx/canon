import { describe, expect, it } from 'vitest'
import { type BootSources, lastBoot } from '@/sessions/boot'

const STAT = [
  'cpu  4039960 14215007 7265328 433045299 296234 0 1322634 0 0 0',
  'btime 1795410604',
  'processes 954240',
  '',
].join('\n')

function unread(): never {
  throw new Error('no such source')
}

function sources(fields: Partial<BootSources>): BootSources {
  return {
    platform: 'linux',
    procStat: unread,
    kernBoottime: unread,
    mountedAt: unread,
    ...fields,
  }
}

describe('lastBoot on Linux', () => {
  it('should read the btime line of the process filesystem in milliseconds', () => {
    const boot = lastBoot(
      sources({ procStat: () => STAT, mountedAt: () => [1_795_410_605_023] }),
    )

    expect(boot).toBe(1_795_410_604_000)
  })

  it('should take the earliest mount time where a clock step moved btime past it', () => {
    const boot = lastBoot(
      sources({
        procStat: () => STAT.replace('1795410604', '1795425889'),
        mountedAt: () => [1_795_410_605_428, 1_795_410_605_023],
      }),
    )

    expect(boot).toBe(1_795_410_605_023)
  })

  it('should read undefined where btime is absent', () => {
    const boot = lastBoot(
      sources({ procStat: () => 'cpu  1 2 3\n', mountedAt: () => [1_000] }),
    )

    expect(boot).toBeUndefined()
  })

  it('should read undefined where btime is zero', () => {
    const boot = lastBoot(
      sources({ procStat: () => 'btime 0\n', mountedAt: () => [1_000] }),
    )

    expect(boot).toBeUndefined()
  })

  it('should read undefined where the process filesystem cannot be read', () => {
    expect(lastBoot(sources({ mountedAt: () => [1_000] }))).toBeUndefined()
  })

  it('should read undefined where no mount time bounds btime', () => {
    const boot = lastBoot(
      sources({ procStat: () => STAT, mountedAt: () => [] }),
    )

    expect(boot).toBeUndefined()
  })

  it('should read undefined where the mount times cannot be read', () => {
    expect(lastBoot(sources({ procStat: () => STAT }))).toBeUndefined()
  })
})

describe('lastBoot on macOS', () => {
  it('should read the sec field rather than usec', () => {
    const boot = lastBoot(
      sources({
        platform: 'darwin',
        kernBoottime: () =>
          '{ sec = 1795410604, usec = 372281 } Mon Nov 23 05:10:04 2026\n',
      }),
    )

    expect(boot).toBe(1_795_410_604_000)
  })

  it('should read undefined where the output carries no sec field', () => {
    const boot = lastBoot(
      sources({ platform: 'darwin', kernBoottime: () => '{ usec = 372281 }' }),
    )

    expect(boot).toBeUndefined()
  })

  it('should read undefined where sysctl cannot run', () => {
    expect(lastBoot(sources({ platform: 'darwin' }))).toBeUndefined()
  })
})

describe('lastBoot elsewhere', () => {
  it('should read undefined on a platform with neither source', () => {
    const boot = lastBoot(
      sources({
        platform: 'win32',
        procStat: () => STAT,
        mountedAt: () => [1_795_410_605_023],
      }),
    )

    expect(boot).toBeUndefined()
  })
})

describe('lastBoot on this machine', () => {
  it.runIf(process.platform === 'linux' || process.platform === 'darwin')(
    'should read a boot time earlier than this process started',
    () => {
      const started = Date.now() - process.uptime() * 1000

      const boot = lastBoot()

      expect(boot).toBeGreaterThan(0)
      expect(boot).toBeLessThan(started)
    },
  )
})
