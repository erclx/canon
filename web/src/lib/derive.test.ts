import { describe, expect, it } from 'vitest'

import {
  commandNamesFromHelp,
  firstSentence,
  hookActions,
  matchRules,
  requireListed,
  ruleBullet,
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

  it('should keep only the verbs the hook actually runs, in note order', () => {
    const hook = '#!/bin/sh\ncanon records push --json\n'

    expect(hookActions(hook, notes)).toEqual([
      { verb: 'canon records push', effect: 'every record folder' },
    ])
  })

  it('should refuse a hook that runs none of the named verbs', () => {
    expect(() => hookActions('#!/bin/sh\n', notes)).toThrow(/post-merge/)
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
