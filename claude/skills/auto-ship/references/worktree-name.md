---
title: Worktree name from the plan
description: How auto-ship Step 0 names the worktree it enters from the plan the caller supplied, through canon tasks plan-branch, so the branch a dispatcher checked and the branch the worker takes are one string
---

# Name the worktree from the plan

Step 0 of `auto-ship`. The session reads this file when it is in the main worktree and about to invoke `canon:session-worktree`.

This step runs ahead of Step 1, so what it holds is the raw invocation argument rather than a resolved plan. When that argument is a plan path or a bare slug, run the verb on it and hand the result to `canon:session-worktree` as its tier 0 argument:

```bash
canon tasks plan-branch <argument> --json
```

| Record            | Route                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `conforms: true`  | Pass the record's `branch`, already `<type>/<slug>`, and invoke nothing else to derive a name           |
| `conforms: false` | The plan's filename breaks a branch-name cap. Pass `branch` anyway and say the cap it broke             |
| Anything else     | Invoke `canon:session-worktree` bare and let its ladder derive the name, saying the verb did not answer |

Three notes on those routes:

- The caps on a branch name sit in `${CLAUDE_SKILL_DIR}/../git-branch/references/branch.md`
- On `conforms: false`, the alternative is a name this session shortened by hand, a second derivation and the thing this call exists to prevent. `git-branch` decides the rename at ship.
- Anything else covers a refusal, a record carrying no `branch` key, and an installed binary carrying no `plan-branch` subcommand
- Saying the verb did not answer lets a reader tell a derived name from a fallback one

The dispatch runbook runs the same verb on the same plan to pick the branch its collision check clears, so calling it here is what makes the checked branch and the taken branch one string.

A caller that supplied a task path, or supplied nothing at all, has no plan to hand the verb here, since resolving either is Step 1's work. Invoke `canon:session-worktree` bare in both cases.
