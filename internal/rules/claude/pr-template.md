---
description: Keep both pull request template copies in step with the pull request standard
paths:
  - 'claude/skills/git-pr/references/pr.md'
  - 'claude/skills/git-pr/references/pr-examples.md'
  - '.github/pull_request_template.md'
  - 'tooling/base/seeds/.github/pull_request_template.md'
---

# Pull request template standards

## When the standard changes

- Check both template copies in the same change when a body section or a rule `canon labels scan` fails on changes, since a stale template yields a body that fails with no hint.
- Restate in the template only what the scan fails on, and point at the `git-pr` skill for the rest, since a human writing in the GitHub editor never reads `pr.md`.

## The two copies

- Keep the root template and `tooling/base/seeds/.github/pull_request_template.md` byte identical. `src/tooling/stack-goldens.test.ts` holds identity alone, never a match to the standard.
- Name the skill as `git-pr` and no CLI verb in either copy, since Seed independence fails a seed line citing `canon` unless a `/` follows.
