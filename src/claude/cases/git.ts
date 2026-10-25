import type { SkillCase } from '@/claude/skills-rank'

/** The `git-*` skill family: branch, commit, and pull-request mechanics. */
export const GIT_CASES: readonly SkillCase[] = [
  {
    prompt: 'Come up with a conventional name for this branch.',
    expect: 'git-branch',
  },
  {
    prompt: 'I am on main and about to start a feature, create its branch.',
    expect: 'git-branch',
  },
  {
    prompt: "Turn what's staged into one commit message.",
    expect: 'git-commit',
  },
  {
    prompt: "Push a quick follow-up fix onto the PR that's already open.",
    expect: 'git-followup',
  },
  {
    prompt: 'Turn this bug into a GitHub issue and file it.',
    expect: 'git-issue',
  },
  {
    prompt: 'Close #42 without merging, #57 supersedes it.',
    expect: 'git-pr-close',
  },
  {
    prompt: 'Write the title and body for this pull request.',
    expect: 'git-pr',
  },
  {
    prompt: 'Take this finished feature all the way through to an opened PR.',
    expect: 'git-ship',
  },
  {
    prompt:
      'This branch has unrelated commits mixed together, break it into separate branches.',
    expect: 'git-split',
  },
  {
    prompt:
      'These staged changes cover more than one concern, commit them separately.',
    expect: 'git-stage',
  },
  {
    prompt:
      'Show me the linked worktrees and clear out the ones already merged.',
    expect: 'git-worktree',
  },
]
