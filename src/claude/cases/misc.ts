import type { SkillCase } from '@/claude/skills-rank'

/** Skills that share no prefix with any other domain file here. */
export const MISC_CASES: readonly SkillCase[] = [
  {
    prompt:
      'Bundle up every open call that only I can make and ask me all at once.',
    expect: 'decision-escalate',
  },
  {
    prompt:
      'Show me a few different treatments for this callout so I can pick one by looking.',
    expect: 'draft-and-pick',
  },
  {
    prompt:
      'Which layer of this landing page should I settle first, and what has to stay constant across it?',
    expect: 'design-taste',
  },
  {
    prompt:
      'This project has no logo yet. Draft one and give me a social card to go with it.',
    expect: 'draft-identity',
  },
  {
    prompt:
      "I found two sites whose look I want us to draw from. Put them side by side and let's settle which one the design should follow before anyone writes a token.",
    expect: 'sketch-design',
  },
  {
    prompt: 'Fire up the dev server the way this project documents it.',
    expect: 'project-commands',
  },
  {
    prompt:
      "We're about to hit the context limit, write the handoff before we lose state.",
    expect: 'session-compact',
  },
  {
    prompt:
      "I'm moving this session to another machine, write the handoff before I pack it up.",
    expect: 'session-compact',
  },
  {
    prompt:
      'I am the orchestrating session and about to compact, so write the board handoff as a session map on the task board.',
    expect: 'session-map',
  },
  {
    prompt: 'Catch me up on what was in progress before this session started.',
    expect: 'session-resume',
  },
  {
    prompt: "This test just started failing and I don't know why yet.",
    expect: 'systematic-debugging',
  },
  {
    prompt:
      "I'm about to write the retry helper we settled on and nothing covers it yet, so get the failing case in first.",
    expect: 'test-first',
  },
  {
    prompt:
      'The loading state already shipped. Should its test be an e2e test or a component one, and is the one I wrote any good?',
    expect: 'test-craft',
  },
  {
    prompt:
      "The e2e folder has specs and helpers mixed together and I'm adding two more, where should they go?",
    expect: 'codebase-layout',
  },
  {
    prompt: 'Does our github about text still match what the readme says?',
    expect: 'repo-metadata',
  },
  {
    prompt: 'Is there a page anywhere in this repo that covers retries?',
    expect: 'index-lookup',
  },
  {
    prompt: 'Connect this repo to Cloudflare Pages and set up the deploy.',
    expect: 'deploy-cloudflare',
  },
]
