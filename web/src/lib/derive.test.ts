import { describe, expect, it } from 'vitest'

import {
  commandNamesFromHelp,
  firstSentence,
  hookActions,
  matchRules,
  requireListed,
  ruleBullet,
  skillGroups,
} from './derive'

function rule(name: string, paths?: string[]) {
  return { name, description: `${name} description`, paths }
}

describe('matchRules', () => {
  it('should split rules into matched, unmatched and always-loaded', () => {
    const rules = [
      rule('100-typescript', ['**/*.ts']),
      rule('210-astro', ['**/*.astro']),
      rule('000-constitution'),
    ]

    const result = matchRules(rules, 'src/design/tokens.ts')

    expect(result.matched.map((match) => match.name)).toEqual([
      '100-typescript',
    ])
    expect(result.unmatched).toBe(1)
    expect(result.always).toBe(1)
    expect(result.total).toBe(3)
  })

  it('should name the glob that matched rather than the first one listed', () => {
    const rules = [rule('300-testing-ts', ['**/*.test.ts', 'src/**/*.ts'])]

    const [match] = matchRules(rules, 'src/design/tokens.ts').matched

    expect(match?.glob).toBe('src/**/*.ts')
  })

  it('should treat an empty paths list as always loaded', () => {
    const result = matchRules([rule('005-behavior', [])], 'src/x.ts')

    expect(result.always).toBe(1)
    expect(result.unmatched).toBe(0)
  })
})

describe('firstSentence', () => {
  it('should keep the first sentence whole', () => {
    expect(firstSentence('Asserts the role. Use when asked.')).toBe(
      'Asserts the role.',
    )
  })

  it('should return a description with one sentence unchanged', () => {
    expect(firstSentence('Asserts the role')).toBe('Asserts the role')
  })
})

describe('commandNamesFromHelp', () => {
  const help = [
    '┌',
    '├ Usage: canon [command]',
    '│',
    '│  Commands:',
    '│    init [path]        # Bootstrap a project',
    '│    gov [command]      # Governance commands',
    '│    upgrade            # Reinstall the CLI',
    '│',
    '│  Examples:',
    '│    canon sync ../my-app',
    '└',
  ].join('\n')

  it('should read the names listed under Commands and stop at the block end', () => {
    expect(commandNamesFromHelp(help)).toEqual(['init', 'gov', 'upgrade'])
  })

  it('should read names from the plain form a pipe receives', () => {
    const plain = [
      'Usage: canon [command]',
      '',
      '  Commands:',
      '',
      '  Project',
      '    init [path]        # Bootstrap a project',
      '',
      '  Domains',
      '    gov [command]      # Governance commands',
      '',
      '  Sandbox:',
      '    canon sandbox      # Interactive scenario picker',
    ].join('\n')

    expect(commandNamesFromHelp(plain)).toEqual(['init', 'gov'])
  })

  it('should read names across group headings', () => {
    const grouped = [
      '│  Commands:',
      '│',
      '│  Project',
      '│    init [path]        # Bootstrap a project',
      '│',
      '│  Domains',
      '│    gov [command]      # Governance commands',
      '│',
      '│  Examples:',
      '│    canon sync ../my-app',
    ].join('\n')

    expect(commandNamesFromHelp(grouped)).toEqual(['init', 'gov'])
  })

  it('should read names through terminal color codes', () => {
    const escape = '\u001b'
    const colored = help.replace(
      'gov [command]',
      `${escape}[37m` + 'gov' + `${escape}[0m [command]`,
    )

    expect(commandNamesFromHelp(colored)).toContain('gov')
  })

  it('should refuse help carrying no Commands block', () => {
    expect(() => commandNamesFromHelp('Usage: canon')).toThrow(/Commands/)
  })
})

describe('requireListed', () => {
  it('should return the used names when every one is in the catalog', () => {
    expect(requireListed(['gov'], ['gov', 'tasks'], 'commands')).toEqual([
      'gov',
    ])
  })

  it('should refuse a used name the catalog no longer carries', () => {
    expect(() =>
      requireListed(['gov', 'retired'], ['gov'], 'commands'),
    ).toThrow(/retired/)
  })
})

describe('hookActions', () => {
  const notes = {
    'canon tasks archive': 'the task closed',
    'canon records push': 'every record folder',
  }

  const hook = '#!/bin/sh\ncanon hooks post-merge --root "$root"\n'

  it('should keep only the verbs the post-merge verb runs, in note order', () => {
    const help = 'Steps:\n  canon records push\n  canon upgrade\n'

    expect(hookActions(hook, help, notes)).toEqual([
      { verb: 'canon records push', effect: 'every record folder' },
    ])
  })

  it('should refuse a hook that no longer calls the post-merge verb', () => {
    const help = '  canon records push\n'

    expect(() => hookActions('#!/bin/sh\n', help, notes)).toThrow(
      /no longer calls/,
    )
  })

  it('should refuse a hook naming the verb only in a comment and the probe', () => {
    const help = '  canon records push\n'
    const probeOnly =
      '#!/bin/sh\n# Hands every step to canon hooks post-merge.\n' +
      'if ! canon hooks post-merge --help >/dev/null 2>&1; then\n  exit 0\nfi\n'

    expect(() => hookActions(probeOnly, help, notes)).toThrow(/no longer calls/)
  })

  it('should refuse a verb that runs none of the named verbs', () => {
    expect(() => hookActions(hook, 'Steps:\n', notes)).toThrow(/runs none/)
  })
})

describe('ruleBullet', () => {
  const text =
    '# Planning\n\n- Analyze requests.\n- Write the test first. Then code.\n'

  it('should return the bullet opening with the given words', () => {
    expect(ruleBullet(text, 'Write the test')).toBe(
      'Write the test first. Then code.',
    )
  })

  it('should refuse a rule that no longer carries the bullet', () => {
    expect(() => ruleBullet(text, 'Delete the test')).toThrow(/Delete the test/)
  })
})

function mapOf(...groups: [string, [string, string][]][]) {
  return groups
    .map(([heading, rows]) =>
      [
        `## ${heading}`,
        '',
        '| Skill | When to use |',
        '| --- | --- |',
        ...rows.map(([name, usage]) => `| \`canon:${name}\` | ${usage} |`),
      ].join('\n'),
    )
    .join('\n\n')
}

const FAMILIES = [
  { key: 'first', group: 'First moment' },
  { key: 'second', group: 'Second moment' },
  { key: 'other', group: 'Moment' },
]

/** Catalog entries, each name filed under the family keyed in `family`. */
function catalog(family: Record<string, string | null>) {
  return Object.entries(family).map(([name, key]) => ({ name, family: key }))
}

describe('skillGroups', () => {
  it('should return groups in vocabulary order rather than page order', () => {
    const markdown = mapOf(
      ['Second moment', [['beta', 'When b']]],
      ['First moment', [['alpha', 'When a']]],
    )

    const groups = skillGroups(
      markdown,
      catalog({ alpha: 'first', beta: 'second' }),
      FAMILIES,
    )

    expect(groups).toEqual([
      { group: 'First moment', skills: [{ name: 'alpha', usage: 'When a' }] },
      { group: 'Second moment', skills: [{ name: 'beta', usage: 'When b' }] },
    ])
  })

  it('should keep the page order of rows inside a group', () => {
    const markdown = mapOf([
      'Moment',
      [
        ['beta', 'When b'],
        ['alpha', 'When a'],
      ],
    ])

    const [group] = skillGroups(
      markdown,
      catalog({ alpha: 'other', beta: 'other' }),
      FAMILIES,
    )

    expect(group?.skills.map((skill) => skill.name)).toEqual(['beta', 'alpha'])
  })

  it('should refuse a row filed under a heading that is not its family group, naming it', () => {
    const markdown = mapOf(
      ['First moment', [['alpha', 'When a']]],
      ['Second moment', [['beta', 'When b']]],
    )

    expect(() =>
      skillGroups(
        markdown,
        catalog({ alpha: 'second', beta: 'second' }),
        FAMILIES,
      ),
    ).toThrow(/alpha under First moment, family group Second moment/)
  })

  it('should refuse a row whose skill declares no known family', () => {
    const markdown = mapOf(['Moment', [['alpha', 'When a']]])

    expect(() =>
      skillGroups(markdown, catalog({ alpha: null }), FAMILIES),
    ).toThrow(/alpha under Moment, no known family/)
  })

  it('should match a heading to its group exactly after trimming', () => {
    const markdown = mapOf(['moment', [['alpha', 'When a']]])

    expect(() =>
      skillGroups(markdown, catalog({ alpha: 'other' }), FAMILIES),
    ).toThrow(/headings naming no family group: moment/)
  })

  it('should accept a heading carrying trailing space', () => {
    const markdown = mapOf(['Moment  ', [['alpha', 'When a']]])

    const groups = skillGroups(markdown, catalog({ alpha: 'other' }), FAMILIES)

    expect(groups.map((entry) => entry.group)).toEqual(['Moment'])
  })

  it('should remove an HTML comment and backticks from the usage text', () => {
    const markdown = mapOf([
      'Moment',
      [['alpha', 'Use `beta` first <!-- canon-keep-retired -->']],
    ])

    const [group] = skillGroups(markdown, catalog({ alpha: 'other' }), FAMILIES)

    expect(group?.skills[0]?.usage).toBe('Use beta first')
  })

  it('should refuse a catalog skill with no row, naming it', () => {
    const markdown = mapOf(['Moment', [['alpha', 'When a']]])

    expect(() =>
      skillGroups(
        markdown,
        catalog({ alpha: 'other', gamma: 'other' }),
        FAMILIES,
      ),
    ).toThrow(/gamma/)
  })

  it('should refuse a row naming no catalog skill, naming it', () => {
    const markdown = mapOf([
      'Moment',
      [
        ['alpha', 'When a'],
        ['ghost', 'x'],
      ],
    ])

    expect(() =>
      skillGroups(markdown, catalog({ alpha: 'other' }), FAMILIES),
    ).toThrow(/ghost/)
  })

  it('should refuse a skill listed twice', () => {
    const markdown = mapOf(['Moment', [['alpha', 'When a']]], ['Moment', []])
    const twice = `${markdown}\n| \`canon:alpha\` | Again |`

    expect(() =>
      skillGroups(twice, catalog({ alpha: 'other' }), FAMILIES),
    ).toThrow(/listed twice: alpha/)
  })

  it('should render no group for a family heading without skill rows', () => {
    const markdown = mapOf(
      ['First moment', []],
      ['Moment', [['alpha', 'When a']]],
    )

    const groups = skillGroups(markdown, catalog({ alpha: 'other' }), FAMILIES)

    expect(groups.map((entry) => entry.group)).toEqual(['Moment'])
  })

  it('should refuse a heading naming no family group even with no rows under it', () => {
    const markdown = `${mapOf(['Moment', [['alpha', 'When a']]])}\n\n## Notes\n\n| Term | Meaning |\n| --- | --- |\n| \`x\` | y |\n`

    expect(() =>
      skillGroups(markdown, catalog({ alpha: 'other' }), FAMILIES),
    ).toThrow(/headings naming no family group: Notes/)
  })

  it('should refuse a row it cannot read rather than skip it', () => {
    const markdown = '## Moment\n\n| `canon:alpha` | a \\| b |\n'

    expect(() =>
      skillGroups(markdown, catalog({ alpha: 'other' }), FAMILIES),
    ).toThrow(/alpha/)
  })
})
