import { describe, expect, it } from 'vitest'
import {
  AGENT_CLI,
  CHROMIUM_REVISION,
  browsersRoot,
  planAgentCall,
} from '@/browser/agent-cli'

const installed = () => true
const missing = () => false

describe('planAgentCall', () => {
  it('should force the bundled Chromium onto open', () => {
    const call = planAgentCall(['open', 'http://localhost:4321'], installed)

    expect(call).toEqual({
      kind: 'run',
      args: ['open', '--browser=chromium', 'http://localhost:4321'],
    })
  })

  it('should keep leading global flags ahead of the verb', () => {
    const call = planAgentCall(
      ['-s=canon-12', '--raw', 'open', 'http://localhost:4321'],
      installed,
    )

    expect(call).toEqual({
      kind: 'run',
      args: [
        '-s=canon-12',
        '--raw',
        'open',
        '--browser=chromium',
        'http://localhost:4321',
      ],
    })
  })

  it('should add no second browser when the caller names one', () => {
    const args = ['open', '--browser=firefox', 'http://localhost:4321']

    expect(planAgentCall(args, installed)).toEqual({ kind: 'run', args })
  })

  it('should read a spaced browser flag as the caller naming one', () => {
    const args = ['open', '--browser', 'firefox', 'http://localhost:4321']

    expect(planAgentCall(args, installed)).toEqual({ kind: 'run', args })
  })

  it('should pass a verb other than open through untouched', () => {
    const args = ['-s=canon-12', '--raw', 'eval', 'document.title']

    expect(planAgentCall(args, missing)).toEqual({ kind: 'run', args })
  })

  it('should refuse open with the install hint when the revision is absent', () => {
    const call = planAgentCall(['open', 'http://localhost:4321'], missing)

    expect(call.kind).toBe('refused')
    if (call.kind !== 'refused') return
    expect(call.message).toContain(`Chromium revision ${CHROMIUM_REVISION}`)
    expect(call.message).toContain('canon browser install-browser chromium')
  })

  it('should pass a bare flag call such as version through', () => {
    expect(planAgentCall(['--version'], missing)).toEqual({
      kind: 'run',
      args: ['--version'],
    })
  })
})

describe('browsersRoot', () => {
  it('should prefer the browsers path the environment sets', () => {
    expect(
      browsersRoot({ PLAYWRIGHT_BROWSERS_PATH: '/opt/pw' }, 'linux', '/home/x'),
    ).toBe('/opt/pw')
  })

  it('should read the macOS cache on darwin', () => {
    expect(browsersRoot({}, 'darwin', '/Users/x')).toBe(
      '/Users/x/Library/Caches/ms-playwright',
    )
  })

  it('should read the XDG cache elsewhere', () => {
    expect(browsersRoot({}, 'linux', '/home/x')).toBe(
      '/home/x/.cache/ms-playwright',
    )
  })
})

describe('AGENT_CLI', () => {
  it('should pin an exact version', () => {
    expect(AGENT_CLI).toMatch(/^@playwright\/cli@\d+\.\d+\.\d+$/)
  })
})
