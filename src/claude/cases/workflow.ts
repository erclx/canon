import type { SkillCase } from '@/claude/skills-rank'

/**
 * The session workflow skills: feature planning, review, and the artifacts
 * that coordinate work across sessions.
 *
 * Every positive is phrased away from its skill's own quoted trigger, since a
 * verbatim trigger passes by construction and proves nothing about a prompt in
 * someone's own words. Negatives target the pairs whose bodies already state
 * an explicit `Do NOT` boundary against each other, since a boundary in a
 * body does not reach the field a router reads.
 */
export const WORKFLOW_CASES: readonly SkillCase[] = [
  {
    prompt: 'Go fix everything the reviewer flagged on my open PR.',
    expect: 'review-address',
  },
  {
    prompt:
      'Run the whole implement, verify, review, and ship pipeline for the approved plan.',
    expect: 'auto-ship',
  },
  {
    prompt: "Pull together a design system from what's already in the app.",
    expect: 'design-extract',
  },
  {
    prompt: 'Draw me a diagram of how the pieces of this system connect.',
    expect: 'draft-diagram',
  },
  {
    prompt:
      'This onboarding doc needs a hand-drawn picture of the signup-to-active path, sketch it in and make sure it actually renders correctly.',
    expect: 'draft-figure',
  },
  {
    prompt:
      'Bring the internal planning docs under .claude up to date with what we decided this session.',
    expect: 'docs-fold',
  },
  {
    prompt:
      'Sketch out a plan for adding this new capability before we touch any code.',
    expect: 'plan-feature',
  },
  {
    prompt:
      'The video just finished recording. Read it back and tell me what each part shows.',
    expect: 'read-frames',
  },
  {
    prompt:
      'We need to measure this properly before committing to an approach.',
    expect: 'plan-groundwork',
  },
  {
    prompt: 'Take this pile of raw notes and turn it into filed items.',
    expect: 'plan-intake',
  },
  {
    prompt: 'Walk me through the open intake items so I can decide on each.',
    expect: 'plan-intake-answer',
  },
  {
    prompt:
      "Draft a diff-based proposal for tightening this passage in the standard, don't just edit it.",
    expect: 'markdown-propose',
  },
  {
    prompt: 'Pull the durable lessons out of this session before it ends.',
    expect: 'memory-capture',
  },
  {
    prompt:
      'Go through the memory folder and propose what to do with each entry.',
    expect: 'memory-review',
  },
  {
    prompt:
      'Take on the orchestrator role and coordinate the parallel feature builds.',
    expect: 'role-orchestrator',
  },
  {
    prompt:
      'I am writing the plan for a row another session will build. What may I write, and where do I read what is already in flight?',
    expect: 'role-planner',
  },
  {
    prompt: 'Post a formal review with findings on that open pull request.',
    expect: 'review-pr',
  },
  {
    prompt:
      'The screencast draft is finished. Turn it into an actual video now.',
    expect: 'record-screencast',
  },
  {
    prompt:
      'Look over everything that changed on this branch for bugs and edge cases.',
    expect: 'review-branch',
  },
  {
    prompt:
      'What should a review of a change look for beyond bugs, and how much evidence does a finding need?',
    expect: 'review-craft',
  },
  {
    prompt:
      'Go through every task sitting in the backlog and tell me which ones are still worth doing.',
    expect: 'backlog-triage',
  },
  {
    prompt:
      'Our backlog only ever grows, measure each row and suggest which to decline.',
    expect: 'backlog-triage',
  },
  {
    prompt: 'Draft me a script with beats for a screencast recording.',
    expect: 'draft-screencast',
  },
  {
    prompt:
      "Check whether my installed Claude seed docs have drifted from the toolkit's.",
    expect: 'seed-sync',
  },
  {
    prompt: 'Turn this topic into a slide deck I can render.',
    expect: 'draft-slides',
  },
  {
    prompt:
      'Check whether the markdown I changed violates any authoring standards.',
    expect: 'standards-audit',
  },
  // Rot across documents nobody changed is what separates this from
  // `standards-audit`, which is diff-scoped and reports a stated rule broken on
  // a given line. It is also not `target-check`, which asks whether a document
  // exists and holds its sections rather than whether it still describes the
  // tree.
  {
    prompt:
      'Which of our docs have gone stale, grown too long, or ended up in the wrong file?',
    expect: 'document-health',
  },
  {
    prompt: 'Open a new entry on the task board for this piece of work.',
    expect: 'task-board',
  },
  {
    prompt: 'Open a learning workspace so I can study this topic properly.',
    expect: 'teach-workspace',
  },
  {
    prompt:
      'The restyle is finished. Write down what a reviewer has to look at by eye, and which behaviors have no test.',
    expect: 'ui-checklist',
  },
  {
    prompt:
      'Look over the interface and tell me what feels unfinished or confusing.',
    expect: 'ux-audit',
  },
  {
    prompt: 'Tell me the paint and layout cost of this page right now.',
    expect: 'ux-measure',
  },
  {
    prompt:
      'Sit with me while I go through my whole list of app findings one at a time, and write down each pick with what it beat.',
    expect: 'ux-walkthrough',
  },
  {
    prompt:
      'I am building this branch for another session. What am I on the hook for, and what is off limits?',
    expect: 'role-worker',
  },
  {
    prompt: 'Get me set up in a fresh Claude Code worktree for this branch.',
    expect: 'session-worktree',
  },
  {
    prompt:
      'My Write to the plan file at the main root got refused for session isolation. How do I land it there?',
    expect: 'session-worktree',
  },
  {
    prompt:
      'Relay this over to the session that dispatched me. It gave me a sessionId rather than a name, so work out who that is and send it.',
    expect: 'session-relay',
  },
  {
    prompt:
      'I am stuck on a question only the operator can answer. Before I stop and ask it, tell the session that dispatched me, it gave me a sessionId.',
    expect: 'session-relay',
  },

  // Negatives: pairs whose bodies already carry an explicit Do NOT boundary.
  {
    prompt:
      'Refresh the stale sections of README and the docs folder based on what changed.',
    expect: 'docs-sync',
  },
  {
    prompt: 'Sort through this brain dump and write it up as findings.',
    expect: 'plan-intake',
  },
  {
    prompt:
      'Here are my scattered notes from this week, file each one against the codebase with a verdict.',
    expect: 'plan-intake',
  },
  {
    prompt:
      "Go through what's still unanswered in the intake folder and decide.",
    expect: 'plan-intake-answer',
  },
  {
    prompt: 'Check this markdown against the house style rules.',
    expect: 'standards-audit',
  },
  {
    prompt: 'Find the rough, unfinished-feeling spots in this interface.',
    expect: 'ux-audit',
  },
  {
    prompt: 'Tell me the render cost of this page in the browser.',
    expect: 'ux-measure',
  },
]
