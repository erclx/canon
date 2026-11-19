import type { SkillCase } from '@/claude/skills-rank'

/**
 * Scaffolding and the toolkit's own surfaces. The five `target-setup` cases are
 * five entry phrasings of one skill, which its description has to carry.
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
  // An empty folder has no files for setup's detection to read, which is what
  // separates starting a project from bootstrapping one that already exists.
  {
    prompt:
      'This folder is empty, start a new astro project in it and get it on the toolkit.',
    expect: 'target-scaffold',
  },
  // Plain start-a-project phrasings with no word about the folder, the shape
  // that missed the skill in a sandbox run, one per stack and verb.
  {
    prompt: 'start a new astro project here',
    expect: 'target-scaffold',
  },
  {
    prompt: 'create a new vite react app in this folder',
    expect: 'target-scaffold',
  },
  {
    prompt: 'scaffold a next.js app here',
    expect: 'target-scaffold',
  },
  {
    prompt: 'I want to build a python project, set it up from scratch',
    expect: 'target-scaffold',
  },
  {
    prompt: 'spin up a new go service in this directory',
    expect: 'target-scaffold',
  },
  {
    prompt: 'new php project please',
    expect: 'target-scaffold',
  },
  {
    prompt:
      "Before I run this sync, tell me exactly what it's going to overwrite.",
    expect: 'canon-cli',
  },
  {
    prompt: 'Which canon command tells me if my markdown breaks the rules?',
    expect: 'canon-cli',
  },
  {
    prompt:
      'Something about the toolkit itself is broken, write it up and send it back to the maintainers.',
    expect: 'canon-feedback',
  },
  // This scans the whole session and files nothing unpicked, which is what
  // separates it from the one-report skill above.
  {
    prompt:
      'Look back over this session and tell me what, if anything, is worth filing as toolkit feedback.',
    expect: 'session-retro',
  },
  {
    prompt:
      "Whatever the right toolkit command is, get this project's rules installed.",
    expect: 'target-setup',
  },
  // This answers one fixed question across a fixed domain list and repairs
  // nothing, which is what separates it from the setup skill above.
  {
    prompt:
      'Report what this project has fallen behind the toolkit on, domain by domain, and fix nothing.',
    expect: 'target-check',
  },
  // The applying half of the same moment. It previews what the check would
  // report and then writes, which is the line between the two.
  {
    prompt:
      'A new toolkit release is out, bring this project up to it and run whatever migrations it needs.',
    expect: 'target-update',
  },
  {
    prompt:
      "This project needs its own coding rule that the toolkit doesn't ship.",
    expect: 'create-rule',
  },
]
