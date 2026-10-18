import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  applySessionDefaults,
  planSessionDefaults,
  readSessionDefaults,
  type SessionDefaultsRead,
} from '@/migrate/session-defaults'

const dirs: string[] = []

async function makeTarget(settings?: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'canon-session-defaults-'))
  dirs.push(dir)
  if (settings !== undefined) {
    await mkdir(join(dir, '.claude'), { recursive: true })
    await writeFile(join(dir, '.claude', 'settings.json'), settings)
  }
  return dir
}

async function readPlanned(
  dir: string,
): Promise<Extract<SessionDefaultsRead, { kind: 'planned' }>> {
  const read = await readSessionDefaults(dir, '/toolkit')
  if (read.kind !== 'planned')
    throw new Error(`expected a plan, got ${read.kind}`)
  return read
}

async function readTargetSettings(dir: string): Promise<string> {
  return readFile(join(dir, '.claude', 'settings.json'), 'utf8')
}

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  )
})

describe('planSessionDefaults', () => {
  it('should add the deny and turn auto memory off on an empty object', () => {
    const plan = planSessionDefaults({})

    expect(plan.next).toEqual({
      permissions: { deny: ['Agent', 'Task'] },
      autoMemoryEnabled: false,
    })
    expect(plan.changed).toBe(true)
  })

  it('should append to an existing deny list without reordering it', () => {
    const plan = planSessionDefaults({
      permissions: { allow: ['Bash(ls)'], deny: ['Read(**/.env)', 'Task'] },
    })

    expect(plan.next.permissions).toEqual({
      allow: ['Bash(ls)'],
      deny: ['Read(**/.env)', 'Task', 'Agent'],
    })
  })

  it('should leave a person setting auto memory to true alone', () => {
    const plan = planSessionDefaults({ autoMemoryEnabled: true })

    expect(plan.next.autoMemoryEnabled).toBe(true)
  })

  it('should report nothing changed when both defaults are present', () => {
    const plan = planSessionDefaults({
      autoMemoryEnabled: false,
      permissions: { deny: ['Task', 'Agent'] },
    })

    expect(plan.changed).toBe(false)
  })
})

describe('readSessionDefaults', () => {
  it('should refuse the toolkit root', async () => {
    const dir = await makeTarget('{}\n')

    const read = await readSessionDefaults(dir, dir)

    expect(read.kind).toBe('refused')
  })

  it('should report an absent settings file as nothing to migrate', async () => {
    const dir = await makeTarget()

    const read = await readSessionDefaults(dir, '/toolkit')

    expect(read.kind).toBe('absent')
  })

  it('should refuse a file that is not valid JSON, naming it', async () => {
    const dir = await makeTarget('{\n  // a comment\n  "a": 1\n}\n')

    const read = await readSessionDefaults(dir, '/toolkit')

    expect(read).toMatchObject({
      kind: 'refused',
      reason: expect.stringContaining('settings.json'),
    })
  })

  it('should refuse a deny that is not a list rather than replace it', async () => {
    const dir = await makeTarget('{ "permissions": { "deny": "Agent" } }\n')

    const read = await readSessionDefaults(dir, '/toolkit')

    expect(read.kind).toBe('refused')
  })
})

describe('applySessionDefaults', () => {
  it('should write the defaults keeping the file indent', async () => {
    const dir = await makeTarget('{\n    "model": "opus"\n}\n')
    const read = await readPlanned(dir)

    await applySessionDefaults(read)

    expect(await readTargetSettings(dir)).toBe(
      '{\n    "model": "opus",\n    "permissions": {\n        "deny": [\n            "Agent",\n            "Task"\n        ]\n    },\n    "autoMemoryEnabled": false\n}\n',
    )
  })

  it('should change nothing on a second run', async () => {
    const dir = await makeTarget('{}\n')
    await applySessionDefaults(await readPlanned(dir))

    const second = await readSessionDefaults(dir, '/toolkit')

    expect(second).toMatchObject({
      kind: 'planned',
      plan: { changed: false },
    })
  })
})
