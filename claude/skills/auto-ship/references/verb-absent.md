---
title: Verbs absent from an older binary
description: What auto-ship Steps 4 and 6 do when the installed canon binary carries no test-order or autoship classify subcommand, including the written review test and its behavior paths
---

# When the verb is absent

Steps 4 and 6 of `auto-ship`. The session reads this file when the installed binary answers either step's verb with a missing subcommand, since each verb ships with the CLI and this body ships with the plugin.

## Step 4: test order

The verb ships with the CLI and this body ships with the plugin, matching Step 6's own fallback for the classify verb. Report that the check did not run rather than reading a missing subcommand as clean, and continue to Step 5.

## Step 6: review

The verb ships with the CLI and this body ships with the plugin, so a target holding an older binary meets a missing subcommand. Apply the written test by hand there, and say the fallback decided it.

Never read an absent subcommand as a skip. Failing open is the exact defect the verb closes, and a shell that answers `command not found` reaching a body that skips on anything other than a `skip` record would ship every branch unreviewed.

The skip needs both tests to pass: every changed file matches `*.md` or `*.txt`, and no changed file sits under a behavior path. On a pass, skip review entirely and continue to Step 8. Otherwise invoke `canon:review-branch`.

Behavior paths carry two spellings, the one a surface authors at and the one it reaches a session at, so the rule reads the same in a toolkit and in a project that consumed one:

- `claude/skills/` and `.claude/skills/`
- `governance/rules/` and `.claude/rules/`
- `standards/`, which is the authoring root and reaches a reader by resolution rather than by an install, so it carries no `.claude/` spelling
- `internal/` and `tooling/`, which hold the stack references and the seed documents a target is handed
- `CLAUDE.md` at the repository root, named as a file because a path prefix reaches nothing that sits in no folder

Markdown under one of them states what an agent does, so a change there is a behavior change wearing a prose extension. Everything outside them is informational, which keeps `docs/`, `README.md`, and `CHANGELOG.md` skipping without naming them. One behavior file sends the whole branch to review, since documentation shipped beside a behavior change does not cancel it.

Informational prose is already gated by `docs-sync`, `standards-audit`, and pre-push hooks. Running a code-style review on it burns tokens with no signal.

The list covers this toolkit's authoring layout and the layout it installs, which is not every layout. A project keeping executable prose where neither spelling reaches adds the path, and until it does every branch touching it skips review silently.

The verb reads the same set from `src/autoship/paths.ts`, so a path added here belongs there too and a path added there belongs here. Two copies is what the fallback costs, and it stands until a release retires the written half.
