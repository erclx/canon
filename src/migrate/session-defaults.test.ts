import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  applySessionDefaults,
  UI_PASS_DENIED,
  MERGE_VERB,
  MERGE_DENIED,
  PUSH_ALLOWED,
  planSessionDefaults,
  readSessionDefaults,
  type SessionDefaultsRead,
  UI_PASS_ALLOWED,
} from '@/migrate/session-defaults'
import { readSeededHooks } from '@/migrate/hook-wiring'

const TOOLKIT_ROOT = join(import.meta.dirname, '../..')
const PLAN_GUARD_COMMAND = '"$CLAUDE_PROJECT_DIR"/.claude/hooks/plan-guard.sh'

const SEEDED_ALLOW = [...PUSH_ALLOWED, ...UI_PASS_ALLOWED]

/**
 * A Bash rule as Claude Code's permissions page states it: `*` stands in for
 * any text, a trailing `:*` equals ` *`, and a lone trailing ` *` also matches
 * the bare command.
 */
function ruleMatches(rule: string, command: string): boolean {
  const body = rule.replace(/^Bash\((.*)\)$/, '$1').replace(/:\*$/, ' *')
  const escaped = body
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = escaped.join('.*')
  const bare = escaped.length === 2 && body.endsWith(' *')
  return new RegExp(
    `^${bare ? `${escaped[0].trimEnd()}( .*)?` : pattern}$`,
  ).test(command)
}

const dirs: string[] = []

async function makeTarget(
  settings?: string,
  { planGuard = false, scripts = [] as string[] } = {},
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'canon-session-defaults-'))
  dirs.push(dir)
  if (settings !== undefined) {
    await mkdir(join(dir, '.claude'), { recursive: true })
    await writeFile(join(dir, '.claude', 'settings.json'), settings)
  }
  const held = planGuard ? [...scripts, 'plan-guard.sh'] : scripts
  await mkdir(join(dir, '.claude', 'hooks'), { recursive: true })
  for (const script of held) {
    await writeFile(join(dir, '.claude', 'hooks', script), '')
  }
  return dir
}

const DEFAULTS = {
  autoMemoryEnabled: false,
  permissions: {
    allow: SEEDED_ALLOW,
    deny: ['Agent', 'Task', ...MERGE_DENIED, ...UI_PASS_DENIED],
  },
}

const guardEntry = { type: 'command', command: PLAN_GUARD_COMMAND }

let seeded: Record<string, unknown>

beforeAll(async () => {
  seeded = await readSeededHooks(TOOLKIT_ROOT)
})

/** The seeded hooks with only the plan guard's script held. */
function guardOnly() {
  return { seeded, holds: (script: string) => script === 'plan-guard.sh' }
}

async function readPlanned(
  dir: string,
): Promise<Extract<SessionDefaultsRead, { kind: 'planned' }>> {
  const read = await readSessionDefaults(dir, TOOLKIT_ROOT)
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
      permissions: {
        allow: SEEDED_ALLOW,
        deny: ['Agent', 'Task', ...MERGE_DENIED, ...UI_PASS_DENIED],
      },
      autoMemoryEnabled: false,
    })
    expect(plan.changed).toBe(true)
  })

  it('should append to an existing deny list without reordering it', () => {
    const plan = planSessionDefaults({
      permissions: { allow: ['Bash(ls)'], deny: ['Read(**/.env)', 'Task'] },
    })

    expect(plan.next.permissions).toEqual({
      allow: ['Bash(ls)', ...SEEDED_ALLOW],
      deny: [
        'Read(**/.env)',
        'Task',
        'Agent',
        ...MERGE_DENIED,
        ...UI_PASS_DENIED,
      ],
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
      allow: SEEDED_ALLOW,
      deny: [
        'Read(**/.env)',
        'Bash(gh pr merge:*)',
        'Agent',
        'Task',
        'Bash(gh api *pulls/*/merge*)',
        ...UI_PASS_DENIED,
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
      permissions: {
        allow: SEEDED_ALLOW,
        deny: ['Agent', 'Task', ...MERGE_DENIED, ...UI_PASS_DENIED],
      },
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
      permissions: { allow: ['Bash(ls)', ...SEEDED_ALLOW] },
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
      permissions: {
        deny: ['Agent', 'Task', ...MERGE_DENIED, ...UI_PASS_DENIED],
      },
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
      permissions: {
        allow: SEEDED_ALLOW,
        deny: ['Task', 'Agent', ...MERGE_DENIED, ...UI_PASS_DENIED],
      },
    })

    expect(plan.changed).toBe(false)
  })

  it('should add the push allow entries to a file migrated before them', () => {
    const plan = planSessionDefaults({
      autoMemoryEnabled: false,
      permissions: {
        allow: ['Bash(ls)'],
        deny: ['Agent', 'Task', ...MERGE_DENIED, ...UI_PASS_DENIED],
      },
    })

    expect(plan.next.permissions).toEqual({
      allow: ['Bash(ls)', ...SEEDED_ALLOW],
      deny: ['Agent', 'Task', ...MERGE_DENIED, ...UI_PASS_DENIED],
    })
    expect(plan.lacksPushAllow).toBe(true)
    expect(plan.predates).toBe(false)
  })

  it('should add only the push form a hand-added allow list lacks', () => {
    const plan = planSessionDefaults({
      autoMemoryEnabled: false,
      permissions: {
        allow: ['Bash(git push --force-with-lease)'],
        deny: ['Agent', 'Task', ...MERGE_DENIED, ...UI_PASS_DENIED],
      },
    })

    expect(plan.next.permissions).toMatchObject({
      allow: [
        'Bash(git push --force-with-lease)',
        'Bash(git push --force-with-lease origin HEAD)',
        ...UI_PASS_ALLOWED,
      ],
    })
    expect(plan.lacksPushAllow).toBe(true)
  })

  it('should allow only exact push forms, never a wildcard that reaches main', () => {
    expect(PUSH_ALLOWED).toEqual([
      'Bash(git push --force-with-lease)',
      'Bash(git push --force-with-lease origin HEAD)',
    ])
    expect(PUSH_ALLOWED.some((entry) => entry.includes('*'))).toBe(false)
  })
})

describe('planSessionDefaults for the retired merge ask', () => {
  it('should add no ask and leave the old merge deny in place', () => {
    const plan = planSessionDefaults({
      autoMemoryEnabled: false,
      permissions: {
        allow: SEEDED_ALLOW,
        deny: [
          'Agent',
          'Task',
          'Bash(canon pr merge:*)',
          'Bash(gh pr merge:*)',
          ...UI_PASS_DENIED,
        ],
      },
    })

    expect(plan.next.permissions).toEqual({
      allow: SEEDED_ALLOW,
      deny: [
        'Agent',
        'Task',
        'Bash(canon pr merge:*)',
        'Bash(gh pr merge:*)',
        ...UI_PASS_DENIED,
        'Bash(gh api *pulls/*/merge*)',
      ],
    })
    expect(plan.holdsMergeDeny).toBe(true)
    expect(plan.holdsMergeAsk).toBe(false)
  })

  it('should leave a held merge ask in place and report it', () => {
    const plan = planSessionDefaults({
      ...DEFAULTS,
      permissions: { ...DEFAULTS.permissions, ask: ['Bash(canon pr merge:*)'] },
    })

    expect(plan.changed).toBe(false)
    expect(plan.next.permissions).toMatchObject({
      ask: ['Bash(canon pr merge:*)'],
    })
    expect(plan.holdsMergeAsk).toBe(true)
  })

  it('should report no merge ask beside an unrelated ask entry', () => {
    const plan = planSessionDefaults({
      ...DEFAULTS,
      permissions: { ...DEFAULTS.permissions, ask: ['Bash(rm:*)'] },
    })

    expect(plan.changed).toBe(false)
    expect(plan.holdsMergeAsk).toBe(false)
  })

  it('should report neither flag on a file the current seed wrote', () => {
    const plan = planSessionDefaults(DEFAULTS)

    expect(plan.holdsMergeAsk).toBe(false)
    expect(plan.holdsMergeDeny).toBe(false)
    expect(plan.changed).toBe(false)
  })

  it('should not read a file holding the old merge pair alone as predating them', () => {
    const plan = planSessionDefaults({
      permissions: { deny: ['Bash(canon pr merge:*)', 'Bash(gh pr merge:*)'] },
    })

    expect(plan.predates).toBe(false)
    expect(plan.lacksMergeDeny).toBe(true)
  })

  it('should read a file holding the merge ask alone as predating them', () => {
    const plan = planSessionDefaults({
      permissions: { ask: ['Bash(canon pr merge:*)'] },
    })

    expect(plan.predates).toBe(true)
  })

  it('should plan no permissions.ask key', () => {
    const plan = planSessionDefaults({})

    expect(plan.keys.map((key) => key.label)).not.toContain('permissions.ask')
  })

  it.each([
    'canon pr merge 12',
    'canon pr merge 12 --dry-run',
    'canon pr merge',
  ])('should deny none of %s', (command) => {
    expect(ruleMatches(MERGE_VERB, command)).toBe(true)
    expect(MERGE_DENIED.some((rule) => ruleMatches(rule, command))).toBe(false)
  })

  it.each([
    'gh pr merge 12 --squash',
    'gh api -X PUT repos/o/r/pulls/12/merge',
    'gh api repos/o/r/pulls/12/merge --method PUT -f merge_method=squash',
  ])('should deny %s', (command) => {
    expect(MERGE_DENIED.some((rule) => ruleMatches(rule, command))).toBe(true)
  })
})

describe('planSessionDefaults for the UI pass entries', () => {
  it('should add the UI pass entries to a file migrated before them', () => {
    const plan = planSessionDefaults({
      autoMemoryEnabled: false,
      permissions: {
        allow: ['Bash(ls)', ...PUSH_ALLOWED],
        deny: ['Agent', 'Task', ...MERGE_DENIED],
      },
    })

    expect(plan.next.permissions).toEqual({
      allow: ['Bash(ls)', ...PUSH_ALLOWED, ...UI_PASS_ALLOWED],
      deny: ['Agent', 'Task', ...MERGE_DENIED, ...UI_PASS_DENIED],
    })
    expect(plan.lacksUiPassAllow).toBe(true)
    expect(plan.lacksPushAllow).toBe(false)
  })

  it('should leave a file holding every UI pass entry unchanged', () => {
    const plan = planSessionDefaults({
      autoMemoryEnabled: false,
      permissions: {
        allow: [...UI_PASS_ALLOWED].reverse().concat(PUSH_ALLOWED),
        deny: ['Agent', 'Task', ...MERGE_DENIED, ...UI_PASS_DENIED],
      },
    })

    expect(plan.changed).toBe(false)
    expect(plan.lacksUiPassAllow).toBe(false)
  })

  it('should keep a hand-added canon pr deny beside the added allow entries', () => {
    const plan = planSessionDefaults({
      autoMemoryEnabled: false,
      permissions: {
        deny: ['Agent', 'Task', 'Bash(canon pr lift:*)', ...MERGE_DENIED],
      },
    })

    expect(plan.next.permissions).toMatchObject({
      deny: [
        'Agent',
        'Task',
        'Bash(canon pr lift:*)',
        ...MERGE_DENIED,
        ...UI_PASS_DENIED,
      ],
    })
  })

  it('should allow no browser verb, delete, merge, close, or preview', () => {
    const unsafe =
      /canon browser|canon pr (merge|close|preview)|^Bash\((rm|cp)\b/

    expect(UI_PASS_ALLOWED.filter((entry) => unsafe.test(entry))).toEqual([])
  })

  it('should name a subcommand rather than wildcard canon or canon pr', () => {
    const whole = /^Bash\(canon( pr)?:\*\)$/

    expect(UI_PASS_ALLOWED.filter((entry) => whole.test(entry))).toEqual([])
  })

  it.each([
    'canon browser -s=site-12 install-browser chromium',
    'canon browser install-browser chromium',
    'canon pr frames 12 --drop',
    'canon pr frames --prune 14',
  ])('should deny %s ahead of the frames allow', (command) => {
    expect(UI_PASS_DENIED.some((rule) => ruleMatches(rule, command))).toBe(true)
  })

  it('should leave the frames forms a pass runs to the allow', () => {
    const add = 'canon pr frames 12 --add shot.png --box 3 --json'

    expect(UI_PASS_DENIED.some((rule) => ruleMatches(rule, add))).toBe(false)
    expect(UI_PASS_ALLOWED.some((rule) => ruleMatches(rule, add))).toBe(true)
  })

  it('should match the seeded settings file entry for entry', async () => {
    const seed = JSON.parse(
      await readFile(
        join(
          import.meta.dirname,
          '../../tooling/claude/seeds/.claude/settings.json',
        ),
        'utf8',
      ),
    )

    expect(seed.permissions.allow).toEqual(SEEDED_ALLOW)
    expect(seed.permissions.ask).toBeUndefined()
    expect(seed.permissions.deny).toEqual([
      'Agent',
      'Task',
      ...MERGE_DENIED,
      ...UI_PASS_DENIED,
    ])
  })
})

describe('planSessionDefaults with the plan guard installed', () => {
  it('should wire the guard into a settings file holding no hooks', () => {
    const plan = planSessionDefaults(DEFAULTS, guardOnly())

    expect(plan.next.hooks).toEqual({
      PreToolUse: [
        { matcher: 'Write|Edit', hooks: [guardEntry] },
        { matcher: 'Bash', hooks: [guardEntry] },
      ],
    })
    expect(plan.keys).toContainEqual({
      label: 'hooks.PreToolUse',
      changed: true,
    })
    expect(plan.changed).toBe(true)
  })

  it('should append the guard to the seeded groups without reordering them', () => {
    const scratch = { type: 'command', command: 'scratch-guard.sh' }
    const scan = { type: 'command', command: 'review-post-scan.sh' }
    const plan = planSessionDefaults(
      {
        ...DEFAULTS,
        hooks: {
          PreToolUse: [
            { matcher: 'Write|Edit', hooks: [scratch] },
            { matcher: 'Bash', hooks: [scan] },
          ],
          Stop: [],
        },
      },
      guardOnly(),
    )

    expect(plan.next.hooks).toEqual({
      PreToolUse: [
        { matcher: 'Write|Edit', hooks: [scratch, guardEntry] },
        { matcher: 'Bash', hooks: [scan, guardEntry] },
      ],
      Stop: [],
    })
  })

  it('should add nothing to a file already holding both entries', () => {
    const plan = planSessionDefaults(
      {
        ...DEFAULTS,
        hooks: {
          PreToolUse: [
            { matcher: 'Bash', hooks: [guardEntry] },
            { matcher: 'Write|Edit', hooks: [guardEntry] },
          ],
        },
      },
      guardOnly(),
    )

    expect(plan.changed).toBe(false)
  })

  it('should leave a guard wired by hand under another matcher alone', () => {
    const byHand = {
      type: 'command',
      command: 'bash .claude/hooks/plan-guard.sh',
    }
    const hooks = {
      PreToolUse: [
        { matcher: 'Write|Edit|MultiEdit', hooks: [byHand] },
        { matcher: '.*', hooks: [byHand] },
      ],
    }

    const plan = planSessionDefaults({ ...DEFAULTS, hooks }, guardOnly())

    expect(plan.next.hooks).toEqual(hooks)
    expect(plan.changed).toBe(false)
  })

  it.each([
    ['a comma list', 'Bash, Write, Edit'],
    ['an unanchored pattern', '^(Bas|Writ|Edi)'],
  ])('should leave a guard wired by hand under %s alone', (_, matcher) => {
    const hooks = {
      PreToolUse: [
        {
          matcher,
          hooks: [{ type: 'command', command: '.claude/hooks/plan-guard.sh' }],
        },
      ],
    }

    const plan = planSessionDefaults({ ...DEFAULTS, hooks }, guardOnly())

    expect(plan.changed).toBe(false)
  })

  it('should not read an exact name as covering a longer tool name', () => {
    const plan = planSessionDefaults(
      {
        ...DEFAULTS,
        hooks: {
          PreToolUse: [
            { matcher: 'Bash', hooks: [guardEntry] },
            { matcher: 'Writ', hooks: [guardEntry] },
          ],
        },
      },
      guardOnly(),
    )

    expect(plan.changed).toBe(true)
  })

  it('should add only the entry a hand wiring lacks', () => {
    const plan = planSessionDefaults(
      {
        ...DEFAULTS,
        hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [guardEntry] }] },
      },
      guardOnly(),
    )

    expect(plan.next.hooks).toEqual({
      PreToolUse: [
        { matcher: 'Bash', hooks: [guardEntry] },
        { matcher: 'Write|Edit', hooks: [guardEntry] },
      ],
    })
  })

  it('should wire nothing when the project holds no guard script', () => {
    const plan = planSessionDefaults(DEFAULTS)

    expect(plan.next.hooks).toBeUndefined()
    expect(plan.changed).toBe(false)
  })
})

describe('readSessionDefaults', () => {
  it('should plan the guard wiring where the guard script is installed', async () => {
    const dir = await makeTarget(JSON.stringify(DEFAULTS), {
      planGuard: true,
    })

    const read = await readPlanned(dir)

    expect(read.plan.changed).toBe(true)
  })

  it('should plan no wiring where the guard script is absent', async () => {
    const dir = await makeTarget(JSON.stringify(DEFAULTS))

    const read = await readPlanned(dir)

    expect(read.plan.changed).toBe(false)
  })

  it('should refuse a PreToolUse that is not a list rather than replace it', async () => {
    const dir = await makeTarget(
      JSON.stringify({ ...DEFAULTS, hooks: { PreToolUse: {} } }),
      { planGuard: true },
    )

    const read = await readSessionDefaults(dir, TOOLKIT_ROOT)

    expect(read).toMatchObject({
      kind: 'refused',
      reason: expect.stringContaining('hooks.PreToolUse'),
    })
  })

  it('should plan the Stop and PostToolUse keys for held scripts', async () => {
    const dir = await makeTarget(JSON.stringify(DEFAULTS), {
      scripts: ['reply-links.sh', 'pr-create-log.sh'],
    })

    const read = await readPlanned(dir)

    expect(read.plan.keys).toEqual([
      { label: 'permissions.deny', changed: false },
      { label: 'permissions.allow', changed: false },
      { label: 'autoMemoryEnabled', changed: false },
      { label: 'hooks.PreToolUse', changed: false },
      { label: 'hooks.PostToolUse', changed: true },
      { label: 'hooks.Stop', changed: true },
      { label: 'hooks.SessionEnd', changed: false },
    ])
    expect(read.plan.unwired).toEqual([
      { event: 'PostToolUse', script: 'pr-create-log.sh', tools: ['Bash'] },
      { event: 'Stop', script: 'reply-links.sh', tools: [] },
    ])
  })

  it('should plan the SessionEnd key for a held records push script', async () => {
    const dir = await makeTarget(JSON.stringify(DEFAULTS), {
      scripts: ['records-push.sh'],
    })

    const read = await readPlanned(dir)

    expect(read.plan.unwired).toEqual([
      { event: 'SessionEnd', script: 'records-push.sh', tools: [] },
    ])
  })

  it('should report every held script unwired where settings are absent', async () => {
    const dir = await makeTarget(undefined, { scripts: ['reply-links.sh'] })

    const read = await readSessionDefaults(dir, TOOLKIT_ROOT)

    expect(read).toEqual({
      kind: 'absent',
      path: join(dir, '.claude', 'settings.json'),
      unwired: [{ event: 'Stop', script: 'reply-links.sh', tools: [] }],
    })
  })

  it('should refuse a Stop that is not a list, naming the field', async () => {
    const dir = await makeTarget(
      JSON.stringify({ ...DEFAULTS, hooks: { Stop: {} } }),
    )

    const read = await readSessionDefaults(dir, TOOLKIT_ROOT)

    expect(read).toMatchObject({
      kind: 'refused',
      reason: expect.stringContaining('hooks.Stop is not a list'),
    })
  })

  it('should refuse the toolkit root', async () => {
    const dir = await makeTarget('{}\n')

    const read = await readSessionDefaults(dir, dir)

    expect(read.kind).toBe('refused')
  })

  it('should report an absent settings file as nothing to migrate', async () => {
    const dir = await makeTarget()

    const read = await readSessionDefaults(dir, TOOLKIT_ROOT)

    expect(read.kind).toBe('absent')
  })

  it('should refuse a file that is not valid JSON, naming it', async () => {
    const dir = await makeTarget('{\n  // a comment\n  "a": 1\n}\n')

    const read = await readSessionDefaults(dir, TOOLKIT_ROOT)

    expect(read).toMatchObject({
      kind: 'refused',
      reason: expect.stringContaining('settings.json'),
    })
  })

  it('should refuse a deny that is not a list rather than replace it', async () => {
    const dir = await makeTarget('{ "permissions": { "deny": "Agent" } }\n')

    const read = await readSessionDefaults(dir, TOOLKIT_ROOT)

    expect(read.kind).toBe('refused')
  })

  it('should refuse an ask that is not a list rather than replace it', async () => {
    const dir = await makeTarget('{ "permissions": { "ask": "Bash" } }\n')

    const read = await readSessionDefaults(dir, TOOLKIT_ROOT)

    expect(read).toMatchObject({
      kind: 'refused',
      reason: expect.stringContaining('permissions.ask'),
    })
  })

  it('should refuse an allow that is not a list rather than replace it', async () => {
    const dir = await makeTarget('{ "permissions": { "allow": "Bash" } }\n')

    const read = await readSessionDefaults(dir, TOOLKIT_ROOT)

    expect(read.kind).toBe('refused')
  })
})

describe('applySessionDefaults', () => {
  it('should write the defaults keeping the file indent', async () => {
    const dir = await makeTarget('{\n    "model": "opus"\n}\n')
    const read = await readPlanned(dir)

    await applySessionDefaults(read)

    expect(await readTargetSettings(dir)).toBe(
      '{\n    "model": "opus",\n    "permissions": {\n        "deny": [\n            "Agent",\n            "Task",\n            "Bash(gh pr merge:*)",\n            "Bash(gh api *pulls/*/merge*)",\n            "Bash(canon browser *install-browser*)",\n            "Bash(canon pr frames *--drop*)",\n            "Bash(canon pr frames *--prune*)"\n        ],\n        "allow": [\n            "Bash(git push --force-with-lease)",\n            "Bash(git push --force-with-lease origin HEAD)",\n            "Bash(canon drive:*)",\n            "Bash(canon pr head:*)",\n            "Bash(canon pr checks:*)",\n            "Bash(canon pr evidence:*)",\n            "Bash(canon pr local:*)",\n            "Bash(canon pr drive-copy:*)",\n            "Bash(canon pr frames:*)",\n            "Bash(canon pr tick:*)",\n            "Bash(canon pr lift:*)"\n        ]\n    },\n    "autoMemoryEnabled": false\n}\n',
    )
  })

  it('should leave every untouched line byte-identical, a one-line list included', async () => {
    const lines = [
      '{',
      '  "autoMemoryEnabled": false,',
      `  "permissions": { "deny": ${JSON.stringify(DEFAULTS.permissions.deny)}, "allow": ${JSON.stringify(SEEDED_ALLOW)} },`,
      '  "hooks": {',
      '    "Stop": [',
      '      {',
      '        "hooks": [',
      '          {',
      '            "type": "command",',
      '            "command": "\\"$CLAUDE_PROJECT_DIR\\"/.claude/hooks/silent-turn.sh"',
      '          }',
      '        ]',
      '      }',
      '    ]',
      '  }',
      '}',
      '',
    ]
    const dir = await makeTarget(lines.join('\n'), {
      scripts: ['silent-turn.sh', 'reply-links.sh'],
    })

    await applySessionDefaults(await readPlanned(dir))

    expect(await readTargetSettings(dir)).toBe(
      [
        ...lines.slice(0, 10),
        '          },',
        '          {',
        '            "type": "command",',
        '            "command": "\\"$CLAUDE_PROJECT_DIR\\"/.claude/hooks/reply-links.sh"',
        ...lines.slice(10),
      ].join('\n'),
    )
  })

  it.each([
    ['an empty', ''],
    ['a whitespace-only', '  \n'],
  ])('should write %s settings file rather than throw', async (_, source) => {
    const dir = await makeTarget(source, { scripts: ['reply-links.sh'] })

    await applySessionDefaults(await readPlanned(dir))

    expect(JSON.parse(await readTargetSettings(dir)).hooks).toEqual({
      Stop: [
        {
          hooks: [
            {
              type: 'command',
              command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/reply-links.sh',
            },
          ],
        },
      ],
    })
  })

  it('should change nothing on a second run', async () => {
    const dir = await makeTarget('{}\n', { planGuard: true })
    await applySessionDefaults(await readPlanned(dir))

    const second = await readSessionDefaults(dir, TOOLKIT_ROOT)

    expect(second).toMatchObject({
      kind: 'planned',
      plan: { changed: false },
    })
  })
})
