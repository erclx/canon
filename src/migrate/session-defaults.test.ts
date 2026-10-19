import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  applySessionDefaults,
  MERGE_DENIED,
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
      permissions: { deny: ['Agent', 'Task', ...MERGE_DENIED] },
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
      deny: ['Read(**/.env)', 'Task', 'Agent', ...MERGE_DENIED],
    })
  })

  it('should append only the merge entry a hand-added deny list lacks', () => {
    const plan = planSessionDefaults({
      autoMemoryEnabled: false,
      permissions: {
        deny: ['Read(**/.env)', 'Bash(gh pr merge:*)', 'Agent', 'Task'],
      },
    })

    expect(plan.next.permissions).toEqual({
      deny: [
        'Read(**/.env)',
        'Bash(gh pr merge:*)',
        'Agent',
        'Task',
        'Bash(canon pr merge:*)',
      ],
    })
  })

  it('should add the merge entries without touching auto memory set to true', () => {
    const plan = planSessionDefaults({
      autoMemoryEnabled: true,
      permissions: { deny: ['Agent', 'Task'] },
    })

    expect(plan.next).toEqual({
      autoMemoryEnabled: true,
      permissions: { deny: ['Agent', 'Task', ...MERGE_DENIED] },
    })
  })

  it('should keep every other key a write passes over', () => {
    const plan = planSessionDefaults({
      model: 'opus',
      hooks: { Stop: [] },
      permissions: { allow: ['Bash(ls)'] },
    })

    expect(plan.next).toMatchObject({
      model: 'opus',
      hooks: { Stop: [] },
      permissions: { allow: ['Bash(ls)'] },
    })
  })

  it('should flag a file migrated before the merge entries as lacking them', () => {
    const plan = planSessionDefaults({
      autoMemoryEnabled: false,
      permissions: { deny: ['Agent', 'Task'] },
    })

    expect(plan.lacksMergeDeny).toBe(true)
    expect(plan.predates).toBe(false)
    expect(plan.changed).toBe(true)
  })

  it('should not flag a file holding both merge entries as lacking them', () => {
    const plan = planSessionDefaults({
      autoMemoryEnabled: false,
      permissions: { deny: ['Agent', 'Task', ...MERGE_DENIED] },
    })

    expect(plan.lacksMergeDeny).toBe(false)
  })

  it('should leave a person setting auto memory to true alone', () => {
    const plan = planSessionDefaults({ autoMemoryEnabled: true })

    expect(plan.next.autoMemoryEnabled).toBe(true)
  })

  it('should read a file holding none of the defaults as predating them', () => {
    const plan = planSessionDefaults({ permissions: { deny: ['Read(.env)'] } })

    expect(plan.predates).toBe(true)
  })

  it('should not read a file whose deny was removed as predating them', () => {
    const plan = planSessionDefaults({ autoMemoryEnabled: false })

    expect(plan.predates).toBe(false)
  })

  it('should not read a file holding one denied tool as predating them', () => {
    const plan = planSessionDefaults({ permissions: { deny: ['Task'] } })

    expect(plan.predates).toBe(false)
  })

  it('should not read a file holding the merge entries alone as predating them', () => {
    const plan = planSessionDefaults({ permissions: { deny: MERGE_DENIED } })

    expect(plan.predates).toBe(false)
  })

  it('should report nothing changed when both defaults are present', () => {
    const plan = planSessionDefaults({
      autoMemoryEnabled: false,
      permissions: { deny: ['Task', 'Agent', ...MERGE_DENIED] },
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
      '{\n    "model": "opus",\n    "permissions": {\n        "deny": [\n            "Agent",\n            "Task",\n            "Bash(canon pr merge:*)",\n            "Bash(gh pr merge:*)"\n        ]\n    },\n    "autoMemoryEnabled": false\n}\n',
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
