import type { SkillCase } from '@/claude/skills-rank'

/**
 * Script, skill, standard, and doc authoring, plus the two prose
 * skills that revise rather than generate.
 */
export const AUTHORING_CASES: readonly SkillCase[] = [
  {
    prompt:
      'Wire up a GitHub Actions pipeline with parallel jobs for this repo.',
    expect: 'ci-workflow',
  },
  {
    prompt: 'Scaffold a brand-new SKILL.md for this capability.',
    expect: 'create-skill',
  },
  {
    prompt:
      "The docs folder and README are stale against what's on main, refresh them.",
    expect: 'docs-sync',
  },
  {
    prompt:
      'Write a brand-new docs page for the capture command, nothing under docs/ covers it yet.',
    expect: 'draft-doc',
  },
  {
    prompt:
      'I already wrote the finished skill files, package them as a ready folder with a plan and a task for a worker to copy.',
    expect: 'draft-ready',
  },
  {
    prompt: 'This project has no README.md at all, write one from scratch.',
    expect: 'draft-doc',
  },
  {
    prompt:
      'Write a context entry for the payments domain, there is no canon/context page for it yet.',
    expect: 'draft-doc',
  },
  {
    prompt:
      'Draft a wireframe for the settings panel, nothing under canon/wireframes covers that surface yet.',
    expect: 'draft-doc',
  },
  {
    prompt:
      'Write a wiki reference page for Claude Code output styles, no page covers that subject yet.',
    expect: 'draft-doc',
  },
  {
    prompt: 'Say what that dense answer actually means in plain terms.',
    expect: 'restate-plainly',
  },
  {
    prompt: 'This passage reads flat and robotic, give it some real cadence.',
    expect: 'write-human',
  },
  {
    prompt:
      'Which characters does the markdown standard ban, and how should I shape the headings in this doc?',
    expect: 'markdown-craft',
  },
  {
    prompt:
      'Pull the captions off this YouTube link and save them with metadata.',
    expect: 'youtube-transcripts',
  },
]
