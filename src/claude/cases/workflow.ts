import type { SkillCase } from '@/claude/skills-rank'

/**
 * The session workflow skills: feature planning, review, and the artifacts
 * that coordinate work across sessions. Every positive is phrased away from
 * its skill's own trigger, and negatives target pairs with a `Do NOT` boundary.
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
    prompt: 'Draw me a diagram of how the pieces of this system connect.',
    expect: 'draw-figure',
  },
  {
    prompt:
      'This onboarding doc needs a hand-drawn picture of the signup-to-active path, sketch it in and make sure it actually renders correctly.',
    expect: 'draw-figure',
  },
  {
    prompt:
      'Fold what we decided this session into the context entries before this branch goes out.',
    expect: 'context-sync',
  },
  {
    prompt:
      'Sketch out a plan for adding this new capability before we touch any code.',
    expect: 'plan-change',
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
      'Can you retell the intake items in plain words, one at a time, before I answer any?',
    expect: 'plan-intake-answer',
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
      'I was launched to review one pull request another session built. What may I write, and who do I answer to when the pass posts?',
    expect: 'role-reviewer',
  },
  {
    prompt:
      'Open the preview for that pull request and click through each box on its visual checklist, then post what happened.',
    expect: 'review-ui',
  },
  {
    prompt:
      'I pushed another commit to the open PR. Update the screenshot comparison on it so the reviewer sees the current head.',
    expect: 'pr-evidence',
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
    prompt: 'File the open issues on this repo into an intake folder.',
    expect: 'issue-triage',
  },
  // Reads rot across documents nobody changed, not a rule broken on one line, so it is not `target-check`.
  {
    prompt:
      'Which of our docs have gone stale, grown too long, or ended up in the wrong file?',
    expect: 'document-health',
  },
  {
    prompt:
      'Are our requirements and architecture docs still true, and when were they last reviewed?',
    expect: 'document-health',
  },
  // Rot across a whole source tree rather than a document corpus, and a
  // report over the tree as it stands rather than `code-craft` shaping code
  // being written or `review-craft` reading one diff.
  {
    prompt:
      'Our TypeScript modules keep getting bigger. Which source files and functions are oversized enough to split?',
    expect: 'code-health',
  },
  {
    prompt:
      'Audit the codebase for rot: overloaded folders, comment blocks drifting from the code, and code stuffed in strings.',
    expect: 'code-health',
  },
  // A repair rather than a report, and folder by folder until each gates,
  // which is what separates it from `document-health` above.
  {
    prompt:
      'Our docs folder fails the paragraph and bullet limits everywhere, so rewrite it until it passes and lock it in.',
    expect: 'document-repair',
  },
  {
    prompt:
      'Bring the context entries under the density limits one folder at a time and gate each once it is clean.',
    expect: 'document-repair',
  },
  {
    prompt: 'Open a new entry on the task board for this piece of work.',
    expect: 'task-create',
  },
  {
    prompt:
      'This branch finished the pagination work, so tick off whichever board outcomes it actually delivered.',
    expect: 'task-complete',
  },
  {
    prompt: 'Quiz me on what we covered about regular expressions yesterday.',
    expect: 'teach-craft',
  },
  {
    prompt:
      'I have to set up the DNS records and the dashboard settings myself. Take me through each one and keep track of which are left.',
    expect: 'operator-walk',
  },
  {
    prompt:
      'The restyle is finished. Write down what a reviewer has to look at by eye, and which behaviors have no test.',
    expect: 'ui-checklist',
  },
  {
    prompt:
      'Look over the interface and tell me what feels unfinished or confusing.',
    expect: 'ui-audit',
  },
  {
    prompt: 'Tell me the paint and layout cost of this page right now.',
    expect: 'ui-performance',
  },
  {
    prompt:
      'We just tagged the release. Spin up a copy of the build and use it with me as its users would, then file whatever breaks.',
    expect: 'app-drive',
  },
  {
    prompt:
      'Before we plan the next wave, put the built app through every goal in the requirements with me and write up what we hit.',
    expect: 'app-drive',
  },
  {
    prompt:
      'I need real footage of the board import flow for the launch video. Film it from our app so HyperFrames can zoom in on the clicks.',
    expect: 'ui-film',
  },
  {
    prompt:
      'Shoot the takes for the storyboard we wrote, one clip per beat of the app doing its thing.',
    expect: 'ui-film',
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
    prompt: 'Find the rough, unfinished-feeling spots in this interface.',
    expect: 'ui-audit',
  },
  {
    prompt: 'Tell me the render cost of this page in the browser.',
    expect: 'ui-performance',
  },
]
