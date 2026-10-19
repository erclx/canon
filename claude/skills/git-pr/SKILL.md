---
name: git-pr
description: Generates pull request titles and descriptions from git diffs. Use for any PR creation or update, such as when asked to "open a pull request".
metadata:
  family: ship
---

# Git PR

## Context

Read these files in parallel:

- `${CLAUDE_SKILL_DIR}/../git-branch/references/branch.md`: branch format, valid types, and constraints
- `${CLAUDE_SKILL_DIR}/references/pr.md`: structure, rules, and banned phrases
- `${CLAUDE_SKILL_DIR}/references/labels.md`: label map format, matching, and the missing-label warning. Skip when the project has no `canon/config/pr-labels.toml` and no `.claude/canon/pr-labels.toml`.

### Writing standards

Read these in the same pass:

- `${CLAUDE_SKILL_DIR}/../markdown-craft/references/markdown.md`: punctuation and formatting for all generated text
- The `write-human` skill: voice, rhythm, and sentence construction for all generated text
- `${CLAUDE_SKILL_DIR}/../git-commit/references/versioning.md`: phase label vs semver discipline

Resolve the base ref first, because the log range and the diff below both consume it:

```bash
git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null
```

Then run these commands in parallel to gather git context:

- `git remote get-url origin 2>/dev/null || echo "NO_REMOTE"`
- `git branch --show-current 2>/dev/null || echo "unknown"`
- `git log <base>..HEAD --oneline 2>/dev/null || echo "NO_COMMITS"`
- `git diff <base> HEAD -- . ':(exclude)*.lock' ':(exclude)*-lock.json' 2>/dev/null || echo "NO_DIFF"`
- `git diff --name-only <base> HEAD 2>/dev/null || echo "NO_FILES"`

## Diff baseline

Prefer `origin/main` over local `main`. Both reads resolve against `<base>`, so the commits listed and the changes described come from one scope.

Never read a two-dot range against local `main` for either half. It resolves no merge base, so once local `main` moves, the diff reports its newer commits as reversed changes and the log lists commits already on the remote.

### Unusable baseline

The baseline is unusable in two cases, and the no-commits guard below catches both, so stop there rather than describing an empty diff:

- No merge base resolves against either ref.
- The base equals HEAD, whichever ref resolved it. Nothing is committed ahead of the base to compare against.

## Guards

- If the branch name does not match `<type>/<description>`, with the types `branch.md` defines, stop and output:
  `❌ Branch name does not follow conventions. Run /git-branch to rename first.`
- If no commits ahead of main, stop and output:
  `❌ No commits ahead of main. Nothing to PR.`

## Response format

### Preview

Output the preview first.

- **Title:** <title>
- **Files changed:** <count>
- **Analysis:** <brief summary of impact>

After outputting the preview, execute the final command immediately. Claude Code's tool permission dialog is the confirmation gate. Do not wait for user input.

### Testing checkboxes

Follow Testing discipline in `${CLAUDE_SKILL_DIR}/references/pr.md`. Run each check before writing its line, then tick the box and state the result the run reported. Never pre-check based on intent or past sessions.

Leave a box unchecked only for the human-only cases the reference defines, and name which human and why on the same line. A request for the reviewer is not a test result, so it belongs under `## For the reviewer` rather than in the Testing list.

### Name the issues the pull request closes

Ask `canon tasks closes` which issues this pull request closes before writing the body, and put one `Closes #NNN` line per issue last in `## Summary`. Read `${CLAUDE_SKILL_DIR}/references/closing-issues.md` on reaching this step for the invocation, the refusals it skips silently, and why an earlier slice of a sliced task carries none.

### Pre-publish scan

Before running the final command, run the scan in `${CLAUDE_SKILL_DIR}/references/publish.md` against the PR title and body, on top of the banned phrases in `${CLAUDE_SKILL_DIR}/references/pr.md`. The title and body go straight to the remote, so run it whatever backs it downstream.

- It covers the phase-label check as well as the characters, since both reach a reader who has no task board
- It stays required where a `pull_request` job runs the same verb, since an older `canon` carries no such job and none of the newer keys

Write the body here, ahead of the final command, since the scan needs a file to read it from:

```bash
mkdir -p .canon/tmp/pr
cat <<'BODY' > .canon/tmp/pr/body.md
<body content following pr.md template exactly>
BODY
```

Then run:

```bash
canon labels scan --title "<title>" --body-file .canon/tmp/pr/body.md --closes <numbers|none> --json
```

Drop `--closes` when the closes step skipped a refusal, since no list was decided to grade against.

### Reading the scan

Branch on the JSON record rather than the exit code, since a shell function wrapping `canon` can flatten a non-zero exit to 0. Stop and fix the title or body on any key below, and do not proceed to `### Final command` until a re-run comes back clean on all nine.

| Key                 | Fix                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------ |
| `phaseLabels`       | Remove the phase label                                                               |
| `boardReferences`   | Remove the board reference                                                           |
| `sessionLinks`      | Remove the session link                                                              |
| `titleFormatIssues` | Fix the `## Title` rule in `pr.md` it names, being structure, casing, or length      |
| `bannedCharacters`  | Restructure the sentence around the named character                                  |
| `sections`          | Rename or drop each heading in `outside`, and add each required heading in `missing` |
| `missingClosures`   | Add a `Closes #NNN` line for each number listed                                      |
| `strayClosures`     | Delete the closing keyword for each number listed                                    |
| `density`           | Regroup or split the named section per `## Formatting` in `pr.md`, keeping each path |

Leave `cutsRelease` and `semverTags` alone, since a release-please pull request legitimately carries version references its own fixed shape explains.

### Resolving the pull request

The run resolves the pull request once, in the final command below, and every later step reads what that command printed. Nothing else looks the number up again.

- Never detect by head branch alone. A lookup ignoring state returns the closed pull request a reused branch name left behind, so scope it to `state=open`.
- Scope the lookup to the base as well as the head, resolved from the default branch, so detection and create agree on one pull request. A head can carry two bases.
- Call `gh api` against REST rather than `gh pr` or `gh repo view`, which run on GraphQL. A cloud session's GitHub access blocks GraphQL and serves REST.

A detached HEAD gives `git branch --show-current` an empty result, which would read as no open pull request and create a second one. The branch-name guard above stops the run first, since an empty name does not match `<type>/<description>`.

### Labels

Read `${CLAUDE_SKILL_DIR}/references/labels.md` on reaching this step, starting at its `## Labels at run time` section, for the verb to ask, the record to branch on, the fallback, and when `pr_labels` stays empty.

The final command takes the resolved set as `pr_labels` and the record's `uncovered` paths as `pr_uncovered`, which only its fallback path reads.

### Final command

Read `${CLAUDE_SKILL_DIR}/references/final-command.md` on reaching this step, for the one command that pushes and finds or creates the pull request over REST, and for the check binding every write to this branch's pull request.

That command re-scans the live body for a session link, applies the labels through `canon labels apply`, and prints `number=`, `url=`, `head=`, `owed=`, `missingOnRemote=`, and `uncovered=`.

### Record the number on the task

Write the `number` the final command printed onto the task the branch is closing, through `canon tasks pull-request`, and never resolve it again. Skip it when the final command refused on a head mismatch and printed no number.

Read `${CLAUDE_SKILL_DIR}/references/task-number.md` on reaching this step for which task it names, the invocation, the refusals it skips silently, and why the number lands here.

### Post the rendered-surface evidence

Invoke `canon:pr-evidence` with the `<number>` the final command printed, on every pull request this skill opens or edits. Skip it when the final command refused on a head mismatch and printed no number, since that skill must never run against a guessed one.

It finds the checklist and the local server and posts the evidence comparison, the checklist alone, and the preview address. Report it rather than proceeding silently when the skill does not resolve.

## After execution

Respond with `✅ PR: <url>`, using the `url` the final command printed, then add only the label lines below whose condition holds, then the lines `pr-evidence` reported. Add no other text.

| Condition                                     | Line                                                                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Each path in `uncovered=`                     | `⚠️ No label covers <path>. Add a row to canon/config/pr-labels.toml or a [declined] entry.`                |
| `owed=` or `missingOnRemote=` printed a value | `⚠️ Labels not applied: <owed labels not in missingOnRemote>. Not on the remote: <missingOnRemote labels>.` |

### The labels line

`owed=` already holds every absent label, so the first half names `owed=` less the names in `missingOnRemote=`, and the second names `missingOnRemote=` alone. Drop either half that is empty.
