import { describe, expect, it } from 'vitest'
import { agentEnv } from '@/commands/browser'

describe('agentEnv', () => {
  it('should turn the sandbox on for a caller that sets nothing', () => {
    expect(agentEnv({ PATH: '/usr/bin' })).toEqual({
      PATH: '/usr/bin',
      PLAYWRIGHT_MCP_SANDBOX: 'true',
    })
  })

  it("should keep a caller's own value rather than overwrite it", () => {
    expect(agentEnv({ PLAYWRIGHT_MCP_SANDBOX: 'false' })).toEqual({
      PLAYWRIGHT_MCP_SANDBOX: 'false',
    })
  })
})
