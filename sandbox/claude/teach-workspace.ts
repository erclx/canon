import { type StageContext, scenario } from '@/sandbox/scenario'

function seedProject(ctx: StageContext): void {
  ctx.fixtures('claude', 'teach-workspace', 'shared', 'project')
}

/**
 * Stubbed rather than left empty. The sandbox has no network, so the skill's
 * research step cannot run, and an absent resources file would make every arm
 * fail on the one behavior the scenario cannot exercise.
 */
function seedWorkspace(ctx: StageContext, dir: string): void {
  for (const folder of ['reference', 'learning-records', 'lessons', 'assets'])
    ctx.mkdir(`${dir}/${folder}`)

  ctx.fixtures('claude', 'teach-workspace', 'shared', 'workspace')
}

/**
 * Split out of the workspace seed rather than written inside it. The lesson arm
 * is the one that has to find this file absent, since writing it is what the
 * first lesson in a workspace does and a seeded copy makes that step vacuous.
 */
function seedStylesheet(ctx: StageContext): void {
  ctx.fixtures('claude', 'teach-workspace', 'shared', 'stylesheet')
}

/**
 * The promote arm alone. A project with no wiki folder gets a refusal from the
 * skill rather than a scaffold, so the arm that drives a proposal has to seed
 * one, and it seeds the `.claude/` spelling. The wiki holds only
 * Anthropic-owned subjects, so seeding it here is what gives the routing test something to correctly pass over: the regex page belongs to
 * nobody, which routes it to docs instead.
 */
function seedWiki(ctx: StageContext): void {
  ctx.mkdir('.claude/wiki')
  ctx.fixtures('claude', 'teach-workspace', 'promote', '01-wiki')
}

function commitProject(ctx: StageContext): void {
  ctx.git('add', '.')
  ctx.commit('feat(cli): slugify helper')
}

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  prepare: (ctx) => {
    ctx.log.step('Teach sandbox')
    ctx.log.info(
      'open   : no workspace folder yet, one has to be opened from nothing',
    )
    ctx.log.info(
      'resume : a live workspace at 01-regex with one record carrying two wrong answers',
    )
    ctx.log.info(
      'promote: the same workspace beside a wiki, with one reference page to route',
    )
    ctx.log.info(
      'lesson : the same workspace with no stylesheet, so the next lesson writes one',
    )
    ctx.log.info('')
    ctx.log.info(
      'Invoke the prefixed form. The dev-skill injection copies SKILL.md alone,',
    )
    ctx.log.info(
      'so the unprefixed copy cannot resolve the bundled references/teach.md.',
    )
    ctx.log.info(
      'Launch with: claude --plugin-dir <worktree-root>/claude --model sonnet',
    )
  },
  arms: {
    open: (ctx) => {
      seedProject(ctx)

      ctx.mkdir('.canon/teach')

      commitProject(ctx)

      ctx.log.step('Scenario ready: teach opens the first workspace')
      ctx.log.info('Context: .canon/teach/ exists and holds no workspace')
      ctx.log.info(
        '  The invocation carries the starting point, because the skill',
      )
      ctx.log.info(
        '  settles it by asking and a headless run has nobody to answer.',
      )
      ctx.log.info(
        '  A prompt without it leaves the session waiting and writing nothing,',
      )
      ctx.log.info(
        '  which is correct behavior and asserts none of the workspace shape.',
      )
      ctx.log.info('')
      ctx.log.info(
        'Action:  /canon:teach-workspace regex, and I know character classes and',
      )
      ctx.log.info('         anchors but have never written a capture group')
      ctx.log.info(
        'Expect:  declared in fixtures/claude/teach-workspace/open/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:teach-workspace open',
      )
      ctx.log.info(
        '         A folder at .canon/teach/01-regex/ carrying MISSION.md',
      )
      ctx.log.info('         with a date and a success list, RESOURCES.md, and')
      ctx.log.info(
        '         GLOSSARY.md. Nothing written outside .canon/teach/.',
      )
      ctx.log.info('         The session asks what the learner already knows.')
    },
    resume: (ctx) => {
      seedProject(ctx)
      seedWorkspace(ctx, '.canon/teach/01-regex')
      seedStylesheet(ctx)

      commitProject(ctx)

      ctx.log.step('Scenario ready: teach resumes a live workspace')
      ctx.log.info(
        'Context: .canon/teach/01-regex/ holds a mission, resources, a glossary,',
      )
      ctx.log.info('  one reference page, one lesson, and one learning record')
      ctx.log.info(
        '  That record names two wrong answers: a lazy quantifier read as two',
      )
      ctx.log.info(
        '  tokens, and a capture group believed to hold every repetition',
      )
      ctx.log.info(
        '  The mission carries four success lines and one is already met',
      )
      ctx.log.info(
        '  The invocation answers the first miss and repeats the second, since',
      )
      ctx.log.info(
        '  the skill opens on retrieval and stops for an answer that never',
      )
      ctx.log.info('  arrives in a headless run')
      ctx.log.info('')
      ctx.log.info(
        'Action:  /canon:teach-workspace regex. On the retrieval from last time:',
      )
      ctx.log.info(
        '         a+? matches a single a, because the lazy quantifier takes as',
      )
      ctx.log.info(
        '         few as it can. For (ab)* over ababab I still think group 1',
      )
      ctx.log.info('         holds ababab.')
      ctx.log.info(
        '         Run this arm with CANON_SKILL_TEST_MAX_TURNS=60. It needs 28',
      )
      ctx.log.info(
        '         turns and the runner default of 30 leaves no margin.',
      )
      ctx.log.info(
        'Expect:  declared in fixtures/claude/teach-workspace/resume/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:teach-workspace resume',
      )
      ctx.log.info(
        '         Resume detected from the folder rather than asked about.',
      )
      ctx.log.info(
        '         The next lesson opens on the two recorded wrong answers',
      )
      ctx.log.info(
        '         before anything new, and lands at 0002 in both lessons/',
      )
      ctx.log.info(
        '         and learning-records/. No second workspace is opened.',
      )
    },
    promote: (ctx) => {
      seedProject(ctx)
      seedWorkspace(ctx, '.canon/teach/01-regex')
      seedStylesheet(ctx)
      seedWiki(ctx)

      commitProject(ctx)

      // An explicit branch rather than whatever `git init` inherited. The handoff
      // file takes its name from the branch slug, so an arm asserting that file by
      // name has to fix the branch the slug comes off.
      ctx.git('checkout', '-b', 'feat/promote-regex', '-q')

      ctx.log.step(
        'Scenario ready: teach proposes where a durable page belongs',
      )
      ctx.log.info(
        'Context: .canon/teach/01-regex/ holds one reference page, one lesson,',
      )
      ctx.log.info(
        '  and a glossary. The project carries a seeded .claude/wiki/,',
      )
      ctx.log.info(
        '  but the wiki holds only Anthropic-owned subjects, so the routing test',
      )
      ctx.log.info(
        '  has to notice a regex reference page belongs to nobody and route it',
      )
      ctx.log.info(
        "  to the project's docs instead of the wiki sitting right there",
      )
      ctx.log.info(
        '  The invocation confirms the proposal in advance, because the step',
      )
      ctx.log.info(
        '  proposes and waits and a headless run has nobody to confirm',
      )
      ctx.log.info('')
      ctx.log.info(
        'Action:  /canon:teach-workspace promote regex. Confirm whatever you propose',
      )
      ctx.log.info('         for the reference page, I approve it in advance.')
      ctx.log.info(
        'Expect:  declared in fixtures/claude/teach-workspace/promote/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:teach-workspace promote',
      )
      ctx.log.info(
        '         A handoff at .canon/tmp/handoff/teach-promotion/promote-regex.md',
      )
      ctx.log.info('         carrying one heading')
      ctx.log.info(
        '         naming a path under docs/ and the source page under it.',
      )
      ctx.log.info(
        '         Nothing written into .claude/wiki/ or docs/ themselves, and the',
      )
      ctx.log.info('         lesson neither proposed nor carried across.')
    },
    lesson: (ctx) => {
      seedProject(ctx)
      seedWorkspace(ctx, '.canon/teach/01-regex')

      commitProject(ctx)

      ctx.log.step('Scenario ready: teach writes the rendered layer')
      ctx.log.info(
        'Context: .canon/teach/01-regex/ holds the same workspace the resume arm',
      )
      ctx.log.info(
        '  seeds, with one difference: assets/ is empty, so the shared stylesheet',
      )
      ctx.log.info(
        '  is absent and the next lesson is the one that has to write it',
      )
      ctx.log.info(
        '  The seeded lesson sits at 0001, so a correct derivation lands on 0002',
      )
      ctx.log.info(
        '  The invocation answers the recorded retrieval, since the skill opens',
      )
      ctx.log.info('  on it and a headless run has nobody to answer')
      ctx.log.info('')
      ctx.log.info(
        'Action:  /canon:teach-workspace regex. On the retrieval from last time:',
      )
      ctx.log.info(
        '         a+? matches a single a, because the lazy quantifier takes as',
      )
      ctx.log.info(
        '         few as it can. For (ab)* over ababab, group 1 holds only the',
      )
      ctx.log.info('         last ab.')
      ctx.log.info(
        'Expect:  declared in fixtures/claude/teach-workspace/lesson/expect.toml',
      )
      ctx.log.info(
        '         Check it with: canon sandbox check claude:teach-workspace lesson',
      )
      ctx.log.info(
        '         A lesson at lessons/0002-*.html carrying the four marker',
      )
      ctx.log.info(
        '         pairs with the stylesheet and the stepper spliced into the',
      )
      ctx.log.info(
        '         style one, a quiz written as radio inputs, and a stylesheet',
      )
      ctx.log.info('         at assets/course.css that the run wrote.')
      ctx.log.info(
        '         The reply reports progress against the mission success lines.',
      )
    },
  },
})
