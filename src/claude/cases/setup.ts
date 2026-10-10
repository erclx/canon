import type { SkillCase } from '@/claude/skills-rank'

/**
 * `target-setup`, `canon-*`, and `create-rule`: scaffolding and the
 * toolkit's own reference and feedback surfaces.
 *
 * The five `target-setup` cases are one skill read through five entry phrasings
 * rather than five rows that collapsed to a duplicate. Each names a different
 * phase, and the merged description has to carry every one of them, which is
 * the discrimination the six-skill family failed at from the other direction.
 */
export const SETUP_CASES: readonly SkillCase[] = [
  {
    prompt:
      'This project has no rules installed yet, get the right governance in place.',
    expect: 'target-setup',
  },
  {
    prompt:
      "Get the index.md system bootstrapped across this project's folders.",
    expect: 'target-setup',
  },
  {
    prompt:
      'This is a brand-new project, get the toolkit bootstrapped in one shot.',
    expect: 'target-setup',
  },
  {
    prompt:
      "Run through the generated scaffold's scripts and confirm each one passes.",
    expect: 'target-setup',
  },
  {
    prompt:
      'Check that the dev server actually starts and the end-to-end suite passes against the scaffold.',
    expect: 'target-setup',
  },
  {
    prompt:
      "Before I run this sync, tell me exactly what it's going to overwrite.",
    expect: 'canon-cli',
  },
  {
    prompt:
      'Something about the toolkit itself is broken, write it up and send it back to the maintainers.',
    expect: 'canon-feedback',
  },
  {
    prompt:
      "Whatever the right toolkit command is, get this project's rules installed.",
    expect: 'target-setup',
  },
  {
    prompt:
      'File the open feedback issues on the toolkit repo into an intake folder.',
    expect: 'canon-feedback-triage',
  },
  // This answers one fixed question across a fixed domain list and repairs
  // nothing, which is what separates it from the setup skill above.
  {
    prompt:
      'Report what this project has fallen behind the toolkit on, domain by domain, and fix nothing.',
    expect: 'target-check',
  },
  {
    prompt:
      "This project needs its own coding rule that the toolkit doesn't ship.",
    expect: 'create-rule',
  },
]
