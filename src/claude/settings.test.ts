import { chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  detectIndent,
  planSettings,
  readSettings,
  type SettingsRecord,
  serializeSettings,
  writeSettings,
} from '@/claude/settings'

const STATUS_LINE = 'bash /home/dev/.claude/statusline-command.sh'

function makeTemplate(): SettingsRecord {
  return {
    permissions: {
      allow: ['Bash(bun run *)'],
      deny: ['Read(**/.env)', 'Read(**/.env.*)'],
    },
  }
}

const dirs: string[] = []

async function makeDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'canon-settings-'))
  dirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  )
})

describe('detectIndent', () => {
  it('should read two spaces from a conventionally formatted file', () => {
    expect(detectIndent('{\n  "a": 1\n}\n')).toBe('  ')
  })

  it('should read a tab from a tab indented file', () => {
    expect(detectIndent('{\n\t"a": 1\n}\n')).toBe('\t')
  })

  it('should read four spaces from a wider file', () => {
    expect(detectIndent('{\n    "a": 1\n}\n')).toBe('    ')
  })

  it('should fall back to two spaces for a single line file', () => {
    expect(detectIndent('{"a":1}')).toBe('  ')
  })
})

describe('planSettings', () => {
  it('should report every key as changed for empty settings', () => {
    const plan = planSettings({}, makeTemplate(), STATUS_LINE)

    expect(plan.keys.map((key) => key.label)).toEqual([
      'statusLine',
      'permissions.allow',
      'permissions.deny',
    ])
    expect(plan.keys.every((key) => key.changed)).toBe(true)
  })

  it('should build the statusLine command entry', () => {
    const plan = planSettings({}, makeTemplate(), STATUS_LINE)

    expect(plan.next.statusLine).toEqual({
      type: 'command',
      command: STATUS_LINE,
    })
  })

  it('should report no change when settings already match', () => {
    const current = planSettings({}, makeTemplate(), STATUS_LINE).next

    const plan = planSettings(current, makeTemplate(), STATUS_LINE)

    expect(plan.changed).toBe(false)
  })

  it('should keep unrelated top level keys', () => {
    const current: SettingsRecord = { model: 'opus', env: { FOO: 'bar' } }

    const plan = planSettings(current, makeTemplate(), STATUS_LINE)

    expect(plan.next.model).toBe('opus')
    expect(plan.next.env).toEqual({ FOO: 'bar' })
  })

  it('should union permission lists into a sorted set', () => {
    const current: SettingsRecord = {
      permissions: { allow: ['Bash(git status)'], deny: [] },
    }

    const plan = planSettings(current, makeTemplate(), STATUS_LINE)

    expect(plan.next.permissions).toEqual({
      allow: ['Bash(bun run *)', 'Bash(git status)'],
      deny: ['Read(**/.env)', 'Read(**/.env.*)'],
    })
  })

  it('should keep unrelated permission fields', () => {
    const current: SettingsRecord = {
      permissions: { ask: ['Bash(rm *)'], allow: [], deny: [] },
    }

    const plan = planSettings(current, makeTemplate(), STATUS_LINE)

    expect((plan.next.permissions as SettingsRecord).ask).toEqual([
      'Bash(rm *)',
    ])
  })

  it('should replace a statusLine pointing at a different script', () => {
    const current: SettingsRecord = {
      statusLine: { type: 'command', command: 'bash /old/path.sh' },
    }

    const plan = planSettings(current, makeTemplate(), STATUS_LINE)

    expect(plan.keys[0]).toEqual({ label: 'statusLine', changed: true })
  })

  it('should not reorder keys that already exist', () => {
    const current: SettingsRecord = {
      model: 'opus',
      permissions: { allow: [], deny: [] },
    }

    const plan = planSettings(current, makeTemplate(), STATUS_LINE)

    expect(Object.keys(plan.next)).toEqual([
      'model',
      'permissions',
      'statusLine',
    ])
  })

  it('should remove the empty attribution pair an earlier setup wrote', () => {
    const current: SettingsRecord = { attribution: { commit: '', pr: '' } }

    const plan = planSettings(current, makeTemplate(), STATUS_LINE)

    expect(plan.next).not.toHaveProperty('attribution')
    expect(plan.keys).toContainEqual({ label: 'attribution', changed: true })
  })

  it('should leave a person own attribution alone', () => {
    const attribution = { commit: 'Co-authored-by: me', pr: '' }

    const plan = planSettings({ attribution }, makeTemplate(), STATUS_LINE)

    expect(plan.next.attribution).toEqual(attribution)
    expect(plan.keys.map((key) => key.label)).not.toContain('attribution')
  })

  it('should leave an absent attribution absent', () => {
    const plan = planSettings({}, makeTemplate(), STATUS_LINE)

    expect(plan.next).not.toHaveProperty('attribution')
    expect(plan.keys.map((key) => key.label)).not.toContain('attribution')
  })
})

describe('serializeSettings', () => {
  it('should write two space JSON with a trailing newline', () => {
    expect(serializeSettings({ a: 1 }, '  ')).toBe('{\n  "a": 1\n}\n')
  })

  it('should honour a tab indent', () => {
    expect(serializeSettings({ a: 1 }, '\t')).toBe('{\n\t"a": 1\n}\n')
  })
})

describe('readSettings', () => {
  it('should treat a missing file as empty settings', async () => {
    const dir = await makeDir()

    const result = await readSettings(join(dir, 'settings.json'))

    expect(result.value).toEqual({})
  })

  it('should carry the detected indent back to the caller', async () => {
    const dir = await makeDir()
    const path = join(dir, 'settings.json')
    await writeFile(path, '{\n\t"model": "opus"\n}\n')

    const result = await readSettings(path)

    expect(result.indent).toBe('\t')
  })

  it('should reject a malformed file rather than resolve it to empty', async () => {
    const dir = await makeDir()
    const path = join(dir, 'settings.json')
    await writeFile(path, '{ not json')

    await expect(readSettings(path)).rejects.toThrow('not valid JSON')
  })

  it('should reject a top level array', async () => {
    const dir = await makeDir()
    const path = join(dir, 'settings.json')
    await writeFile(path, '[]')

    await expect(readSettings(path)).rejects.toThrow('not a JSON object')
  })
})

describe('writeSettings', () => {
  it('should preserve the existing file mode', async () => {
    const dir = await makeDir()
    const path = join(dir, 'settings.json')
    await writeFile(path, '{}\n')
    await chmod(path, 0o644)

    await writeSettings(path, '{"a":1}\n')

    expect((await stat(path)).mode & 0o777).toBe(0o644)
  })

  it('should preserve a deliberately restricted mode', async () => {
    const dir = await makeDir()
    const path = join(dir, 'settings.json')
    await writeFile(path, '{}\n')
    await chmod(path, 0o600)

    await writeSettings(path, '{"a":1}\n')

    expect((await stat(path)).mode & 0o777).toBe(0o600)
  })

  it('should create the parent directory for a new file', async () => {
    const dir = await makeDir()
    const path = join(dir, 'nested', 'settings.json')

    await writeSettings(path, '{"a":1}\n')

    expect(await readFile(path, 'utf8')).toBe('{"a":1}\n')
  })
})
