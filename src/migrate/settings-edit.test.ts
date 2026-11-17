import { describe, expect, it } from 'vitest'
import { applySettingsEdits } from '@/migrate/settings-edit'

const entry = { type: 'command', command: 'b.sh' }

describe('applySettingsEdits', () => {
  it('should append to a multi-line list leaving a one-line sibling as written', () => {
    const source = [
      '{',
      '  "permissions": { "deny": ["Agent", "Task"] },',
      '  "hooks": {',
      '    "Stop": [',
      '      {',
      '        "hooks": [',
      '          { "type": "command", "command": "a.sh" }',
      '        ]',
      '      }',
      '    ]',
      '  }',
      '}',
      '',
    ].join('\n')

    const next = applySettingsEdits(
      source,
      [{ kind: 'append', path: ['hooks', 'Stop', 0, 'hooks'], value: entry }],
      '  ',
    )

    expect(next).toBe(
      [
        '{',
        '  "permissions": { "deny": ["Agent", "Task"] },',
        '  "hooks": {',
        '    "Stop": [',
        '      {',
        '        "hooks": [',
        '          { "type": "command", "command": "a.sh" },',
        '          {',
        '            "type": "command",',
        '            "command": "b.sh"',
        '          }',
        '        ]',
        '      }',
        '    ]',
        '  }',
        '}',
        '',
      ].join('\n'),
    )
  })

  it('should keep a one-line list on one line when appending to it', () => {
    const next = applySettingsEdits(
      '{\n  "deny": ["Agent", "Task"]\n}\n',
      [{ kind: 'append', path: ['deny'], value: 'Bash(gh pr merge:*)' }],
      '  ',
    )

    expect(next).toBe(
      '{\n  "deny": ["Agent", "Task", "Bash(gh pr merge:*)"]\n}\n',
    )
  })

  it('should add an absent parent once, holding the nested value', () => {
    const next = applySettingsEdits(
      '{\n  "model": "opus"\n}\n',
      [{ kind: 'set', path: ['permissions', 'deny'], value: ['Agent'] }],
      '  ',
    )

    expect(next).toBe(
      '{\n  "model": "opus",\n  "permissions": {\n    "deny": [\n      "Agent"\n    ]\n  }\n}\n',
    )
  })

  it('should create an absent list when appending to it', () => {
    const next = applySettingsEdits(
      '{\n  "hooks": {}\n}\n',
      [{ kind: 'append', path: ['hooks', 'Stop'], value: { hooks: [] } }],
      '  ',
    )

    expect(next).toBe(
      '{\n  "hooks": {\n    "Stop": [\n      {\n        "hooks": []\n      }\n    ]\n  }\n}\n',
    )
  })

  it('should write inserted lines in a tab-indented CRLF file in its own form', () => {
    const source = '{\r\n\t"hooks": {\r\n\t\t"Stop": []\r\n\t}\r\n}\r\n'

    const next = applySettingsEdits(
      source,
      [{ kind: 'append', path: ['hooks', 'Stop'], value: { hooks: [] } }],
      '\t',
    )

    expect(next).toBe(
      '{\r\n\t"hooks": {\r\n\t\t"Stop": [\r\n\t\t\t{\r\n\t\t\t\t"hooks": []\r\n\t\t\t}\r\n\t\t]\r\n\t}\r\n}\r\n',
    )
  })

  it('should insert into an empty root object', () => {
    const next = applySettingsEdits(
      '{}\n',
      [{ kind: 'set', path: ['autoMemoryEnabled'], value: false }],
      '  ',
    )

    expect(next).toBe('{\n  "autoMemoryEnabled": false\n}\n')
  })

  it('should refuse to set a property the file already holds', () => {
    expect(() =>
      applySettingsEdits(
        '{ "autoMemoryEnabled": true }',
        [{ kind: 'set', path: ['autoMemoryEnabled'], value: false }],
        '  ',
      ),
    ).toThrow('already set')
  })
})
