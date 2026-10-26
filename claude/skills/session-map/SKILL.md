---
name: session-map
description: Writes the session map, the board-side handoff at `.canon/tasks/session-<slug>.md`, for an orchestrating session or on a request naming the session map or the task board, running the skill-drift step the write procedure opens with. Use when asked to "write the session map", "write the board handoff", or when a session holding `canon:role-orchestrator` hands off before a compaction. Do NOT use for a plain session about to compact, which is `session-compact` and writes a note outside the board. Do NOT use to read a handoff back, which is `session-resume`.
metadata:
  family: parallel
---

# Session map

Write the pre-compaction handoff for the current session. `${CLAUDE_SKILL_DIR}/references/session.md` fixes the filename, the frontmatter, the three core sections, the numbered write procedure, and the citation rule, so follow it rather than this body.

Any session writes one. Do not assert a role on invocation, and do not add a role's sections to a map written by a session holding no such role.

## Run every step

Run every step rather than judging in advance that one has nothing to act on. The drift verb answers for itself, refusal included, and a refusal recorded is a result where a prediction of one is not.

A project carrying none of the scaffolding the step reads is where skipping looks most defensible, and it is the case this rule fires on.

## What fires this

| Caller                                                    | Route                                                                        |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| A plain session asking for a board map                    | Being asked                                                                  |
| The orchestrator                                          | Its handoff runbook                                                          |
| A plain session about to compact                          | `session-compact`, which the `PreCompact` hook on the `manual` matcher names |
| A session holding `canon:role-orchestrator` at compaction | Here, through one sentence in that hook's message                            |

### Declining

Decline where the session holds no reasoning a reader could not get faster from git. Say so in one line and write nothing.

A `## State` filled from the tree is non-conforming per the standard, and a map of three such sections is worse than none, because a reader who finds a map trusts it. A decline is a result the caller can act on.

## Guards

- If `git rev-parse --git-dir` does not resolve, stop: `❌ Not a git repository. A session map takes its filename from the branch.`
- Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../git-branch/references/slug.md`. An empty result falls back to `latest`, since a stop loses the reasoning the file exists to save.
- Resolve the containing folder at the main worktree root with `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`
  - It takes no fallback, since the guard above already stopped where no repository answers

## Step 1: recover the commit the drift step reads

Item 1 of `## Writing one` runs `canon claude skills drift <ref>` against the commit this session started from, which nothing on the machine records. Estimate how long the session has run, round up, and read the ref item 2 recovers:

```bash
git log -1 --format=%H --before='<duration> ago'
```

Round up rather than down. An older ref over-reports, and confirming a name it raises costs one read of that body, so the generous end is the safe one.

### Record what the verb names

Record what the verb names under `## Standing cautions`, and keep writing.

- A refusal marks the boundary of what the verb reads, not a fault. It answers where the working directory carries `claude/skills/` with history, and refuses where the plugin comes from a cache.
- Record the boundary the verb reported, not the one it looked likely to report

## Step 2: write the map

Follow items 3 through 6. Start from the board and the roster rather than the prior map, write only what a compaction destroys and no other artifact already carries, and cite a commit, a task, or a file and line for every claim about the tree.

Item 6 runs `canon records validate sessions session-<slug>` once the file is written.

- It reports the count and never fails on length, so a map over the cap is still written
- A refusal, such as `unknown-kind` from a CLI older than this plugin, takes the count line's place as its `reason`
- The count it reports closes the output

The file sits at the main worktree root and is written whole every time, so send it out as a heredoc, routed the way `session-worktree` states.

## Step 3: extend it only where a role is held

`## Extending it` governs a section added over the core three. Add one only when this session holds the role and the surface owning that role states the section, since a section the writer cannot fill teaches its reader to skip the file.

A session holding no role writes the core three and stops.

## Output

```plaintext
✅ Session map written: .canon/tasks/session-<slug>.md
<what the drift verb named, or the boundary it refused at>
<words> of <cap> words, as canon records validate sessions reported, or the reason it refused
```

A decline reports itself rather than falling silent, so a caller can tell it from a run that failed:

```plaintext
✅ No session map. <what the session holds that git does not, and why it is nothing>
<what the drift verb named, or the boundary it refused at>
```

Emit the path from the project root. The `## Output` section of the project's instruction file sets the form it takes.
