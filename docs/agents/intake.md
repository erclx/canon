---
title: Intake
description: Reading intake folder counts and items, the three read states an item can be in, landing a batch of selections in one cluster, the refusal reasons, and why a call is scoped to one file
---

# Intake

## List

`canon intake list` reports the intake folders under `.canon/intake/`, or the items one folder holds. It reads and never writes, because an answer belongs to the operator and a verb that filled one would decide what the folder exists to ask.

A folder carries a two-digit ordinal ahead of its slug, as in `21-toolkit-overview`, so a listing sorts by when each opened. A bare slug still resolves: passing `toolkit-overview` matches the one folder whose name is an ordinal ahead of it, and the folder's real name is what every command reports back.

```bash
canon intake list
canon intake list toolkit-overview --unread --json
```

| Option          | Behavior                                                                  |
| --------------- | ------------------------------------------------------------------------- |
| `--unread`      | Keep only what is unread: folders carrying one, or a folder's empty slots |
| `--json`        | Emit a machine-readable record on stdout                                  |
| `--root <path>` | Intake root, defaulting to the main worktree                              |

With no slug it reports per-folder counts. With one it reports every item grouped by the cluster file holding it, each carrying its label, title, open question, suggestion, and answer.

An item sits in one of three read states, and the counts keep them apart:

| State     | What it means                                           |
| --------- | ------------------------------------------------------- |
| unread    | The slot is present and empty, so nobody has reached it |
| answered  | The slot carries text, which is a decision already made |
| malformed | The item carries no slot, so no verb here can answer it |

The third is counted apart from both rather than folded into either. Counted as answered it hides a file that needs fixing behind a folder reading as fully worked through, and counted as unread it joins a list whose every entry `answer` then refuses.

The index is skipped, since it points at items and answers nothing itself. So is any item a file displays inside a fence, which is how a folder copying the item format into its own overview is read as the sample it is rather than as an item offering a slot no reader owns.

## Answer

`canon intake answer` writes selections into the answer slots of one cluster file.

```bash
canon intake answer toolkit-overview --cluster 05-coverage.md --set 3=ok
canon intake answer toolkit-overview --cluster 11-intake-skill.md --set 3d=ok --set 9="not worth it" --json
```

| Option                | Behavior                                              |
| --------------------- | ----------------------------------------------------- |
| `--cluster <file>`    | Cluster file the items live in, with or without `.md` |
| `--set <item=answer>` | Answer to land on an item, repeatable                 |
| `--json`              | Emit a machine-readable record on stdout              |
| `--root <path>`       | Intake root, defaulting to the main worktree          |

Items are labeled per cluster file, so a selection names the cluster and the label together. A label alone names an item in every cluster at once.

A label may carry a letter suffix, as in `3a` beside `3`, which is how a pass records a finding split after the fact rather than renumbering every item below it. Pass it exactly as the heading spells it.

One call writes one cluster. A call per selection is the alternative, and several of those against the same file read it before any of them writes, so every answer but the last is lost with nothing reporting it. The selections split on the first `=`, so an answer carrying its own survives intact.

An item already carrying an answer refuses rather than being overwritten, and one filled item refuses the whole batch, so a partly applied write never lands. Drop the named item and send the rest.

Exit codes: `0` every named item now carries its answer, `1` refused. The `reason` field carries `no-intake`, `no-folder`, `ambiguous-slug`, `no-cluster`, `no-item`, `answered`, or `bad-input`. A bare slug matching more than one ordinal-prefixed folder refuses as `ambiguous-slug` rather than `no-folder`, naming every match in `detail`.

An exit code says nothing about a call made from a session, since a shell profile may wrap the binary in a function taking its status from a later command. Read the record's `reason` rather than the exit when a skill consumes this, which matters most here because the verb writes.

`bad-input` covers a malformed command line: no cluster, no selection, a selection that parses to no label and answer, an empty answer, an answer carrying a line break, or two answers for one item. It is separate from the reasons describing the folder, so a caller that mistyped a flag is not sent to repair a file that is fine.

An empty answer refuses rather than writing an empty slot. The slot means unread while it is empty, so writing one back would report an item as answered that nobody decided.

An answer occupies one line, and one carrying a line break refuses before anything is read. Writing it splices a bare continuation into the item that matches none of the patterns the reader tests, so the slot reads back as the text before the break while the item counts as answered, and the refusal on an already-answered item then leaves hand-editing the file as the only correction. The whole batch refuses, so a good selection beside a broken one never lands half applied.

The folder is shared scratch at the main worktree root, so `--root` defaults to the first entry of `git worktree list` rather than the working directory. The write is an edit inside a file that already exists, which `Edit` and `Write` refuse from a linked worktree and a shell stream editor may not do, so the verb resolves the root in-process and rewrites whole lines.

Skills branch on the reason rather than on the exit code:

```bash
canon intake list toolkit-overview --unread --json | jq -r '.clusters[] | .cluster'
```

For the folder layout, the item format, the answer contract, and retrieval, see `claude/skills/plan-intake/references/intake.md`.
