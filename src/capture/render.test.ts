import { describe, expect, it } from 'vitest'
import { SANDBOX_FIX } from '@/browser/engine'
import { sandboxBlockedMessage } from '@/capture/render'

describe('sandboxBlockedMessage', () => {
  it('should name the sysctl where it is the fix', () => {
    expect(sandboxBlockedMessage(SANDBOX_FIX, 1000)).toContain(SANDBOX_FIX)
  })

  it('should name root rather than the sysctl when run as root', () => {
    const message = sandboxBlockedMessage(undefined, 0)

    expect(message).toContain('root')
    expect(message).not.toContain('sudo')
  })

  it('should name neither the sysctl nor root where something else blocks it', () => {
    const message = sandboxBlockedMessage(undefined, 1000)

    expect(message).toContain('seccomp')
    expect(message).not.toContain('sudo')
  })
})
