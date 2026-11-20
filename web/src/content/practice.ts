/**
 * Craft's practice skills, typed here rather than parsed from the ledger, so
 * `ruleFile` and `ledger` name the two places a reviewer checks each line.
 */

export interface Practice {
  readonly name: string
  readonly loads: string
  readonly rule: string
  /** The skill file the rule is taken from. */
  readonly ruleFile: string
  readonly source: string
  readonly quote: string
  /** The address the ledger row cites beside the quote, which the source's name links to. */
  readonly url: string
  /** The ledger file whose source row carries the quote word for word. */
  readonly ledger: string
}

export const practices: readonly Practice[] = [
  {
    name: 'code-craft',
    loads: 'loads before a new function or module',
    rule: 'When no next change can be named, write the plainest code that passes, since a shape built for an unnamed change is a guess.',
    ruleFile: 'claude/skills/code-craft/SKILL.md',
    source: 'Google, What to look for in a code review',
    quote:
      'solve the problem they know needs to be solved now, not the problem that the developer speculates might need to be solved in the future',
    ledger: 'governance/ledger/skills/code-craft/SKILL.md',
    url: 'https://google.github.io/eng-practices/review/reviewer/looking-for.html',
  },
  {
    name: 'test-craft',
    loads: 'loads before writing a test',
    rule: 'Write the lower test when a higher one catches a break no lower test did.',
    ruleFile: 'claude/skills/test-craft/SKILL.md',
    source: 'Ham Vocke, The Practical Test Pyramid',
    quote: 'Push your tests as far down the test pyramid as you can',
    ledger: 'governance/ledger/skills/test-craft/SKILL.md',
    url: 'https://martinfowler.com/articles/practical-test-pyramid.html',
  },
  {
    name: 'api-design',
    loads: 'loads before shaping a flag, output, or format',
    rule: 'Treat ordering, timing, default values, and the exact text of an error as observable.',
    ruleFile: 'claude/skills/api-design/SKILL.md',
    source: 'Software Engineering at Google, chapter 1',
    quote:
      'all observable behaviors of your system will be depended on by somebody',
    ledger: 'governance/ledger/skills/api-design/SKILL.md',
    url: 'https://abseil.io/resources/swe-book/html/ch01.html',
  },
  {
    name: 'ui-craft',
    loads: 'loads when a rendered file changes',
    rule: 'Use a native <button> or <a> over a <div> carrying a click handler.',
    ruleFile: 'claude/skills/ui-craft/references/a11y.md',
    source: 'W3C, Using ARIA, the first rule',
    quote:
      'If you can use a native HTML element or attribute with the semantics and behavior you require already built in',
    ledger: 'governance/ledger/skills/ui-craft/a11y.md',
    url: 'https://www.w3.org/TR/using-aria/',
  },
  {
    name: 'design-taste',
    loads: 'loads when a rendered file changes',
    rule: 'Never settle a higher layer before the one below it.',
    ruleFile: 'claude/skills/design-taste/SKILL.md',
    source: 'Jesse James Garrett, The Elements of User Experience',
    quote: 'Each plane is dependent on the planes below it.',
    ledger: 'governance/ledger/skills/design-taste/SKILL.md',
    url: 'http://www.jjg.net/elements/pdf/elements_ch02.pdf',
  },
  {
    name: 'review-craft',
    loads: 'loads in every code review',
    rule: 'Design and scope come first: does the change do one thing, and does it build what nobody asked for?',
    ruleFile: 'claude/skills/review-craft/SKILL.md',
    source: 'Google, What to look for in a code review',
    quote:
      'The most important thing to cover in a review is the overall design of the CL',
    ledger: 'governance/ledger/skills/review-craft/SKILL.md',
    url: 'https://google.github.io/eng-practices/review/reviewer/looking-for.html',
  },
  {
    name: 'write-human',
    loads: 'loads before writing prose',
    rule: 'Write for a developer who is scanning rather than studying.',
    ruleFile: 'claude/skills/write-human/SKILL.md',
    source: 'Nielsen Norman Group, How users read on the web',
    quote:
      '79 percent of our test users always scanned any new page they came across',
    ledger: 'governance/ledger/skills/write-human/SKILL.md',
    url: 'https://www.nngroup.com/articles/how-users-read-on-the-web/',
  },
  {
    name: 'systematic-debugging',
    loads: 'loads on a bug nobody has explained',
    rule: 'Trace bad values backward to their source. Fix at the origin, not the symptom.',
    ruleFile: 'claude/skills/systematic-debugging/SKILL.md',
    source: 'Jesse Vincent, superpowers, Systematic Debugging',
    quote: 'Fix at source, not at symptom',
    ledger: 'governance/ledger/skills/systematic-debugging/SKILL.md',
    url: 'https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/systematic-debugging/SKILL.md',
  },
]
