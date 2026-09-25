---
name: git-pr
description: Generates pull request titles and descriptions from git diffs. Use for any PR creation or update, such as when asked to "open a pull request".
---

# Git PR

## Context

Read these files in parallel:

- `${CLAUDE_SKILL_DIR}/../../standards/branch.md`: branch format, valid types, and constraints
- `${CLAUDE_SKILL_DIR}/../../standards/pr.md`: structure, rules, and banned phrases
- `${CLAUDE_SKILL_DIR}/references/labels.md`: label map format, matching, and the missing-label warning. Skip when the project has no `canon/config/pr-labels.toml` and no `.claude/canon/pr-labels.toml`.
- `${CLAUDE_SKILL_DIR}/../../standards/markdown.md`: banned words, punctuation, and formatting for all generated text
- The `write-human` skill: voice, rhythm, and sentence construction for all generated text
- `${CLAUDE_SKILL_DIR}/../../standards/versioning.md`: phase label vs semver discipline

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

`git diff main..HEAD` is the form the diff replaces. A two-dot range compares tips and resolves no merge base, so once local `main` advances past the branch point it reports main's newer commits as reversed changes and the description describes work the branch never did. On `main` itself the local ref resolves to HEAD and every committed change drops out instead.

`git log main..HEAD` is the matching defect on the commit side. It excludes what local `main` reaches, so a local `main` trailing `origin/main` leaves commits in the range that are already on the remote and are not this branch's work. The diff resolved from `<base>` excludes those same commits, and the description then lists commits whose changes appear nowhere in it. Reading both against `<base>` is what keeps the two halves describing one branch.

The baseline is unusable in two cases:

- No merge base resolves against either ref.
- The base equals HEAD, whichever ref resolved it. Nothing is committed ahead of the base to compare against.

Either case leaves both reads empty, which the no-commits guard below catches. Stop there rather than composing a description from an empty diff.

## Guards

- If branch name does not match `<type>/<description>` format (valid types are defined in `${CLAUDE_SKILL_DIR}/../../standards/branch.md`), stop and output:
  `❌ Branch name does not follow conventions. Run /git-branch to rename first.`
- If no commits ahead of main, stop and output:
  `❌ No commits ahead of main. Nothing to PR.`

## Response format

### Preview

- **Title:** <title>
- **Files changed:** <count>
- **Analysis:** <brief summary of impact>

After outputting the preview, execute the final command immediately. Claude Code's tool permission dialog is the confirmation gate. Do not wait for user input.

### Testing checkboxes

Follow Testing discipline in `${CLAUDE_SKILL_DIR}/../../standards/pr.md`. Run each check before writing its line, then tick the box and state the result the run reported. Never pre-check based on intent or past sessions.

Leave a box unchecked only for the human-only cases the reference defines, and name which human and why on the same line. A request for the reviewer is not a test result, so it belongs under `## For the reviewer` rather than in the Testing list.

### Pre-publish scan

Before running the final command, run the scan in `${CLAUDE_SKILL_DIR}/../../standards/publish.md` against the PR title and body. The title and body go straight to the remote with nothing checking them on the way, so run the scan regardless of what backs it downstream. It covers the phase-label check as well as the characters, since both go to a reader who has no task board. It applies on top of the banned phrases in `${CLAUDE_SKILL_DIR}/../../standards/pr.md`.

Write the body here, ahead of the final command, since the scan below needs a file to read it from:

```bash
mkdir -p .canon/tmp/pr
cat <<'BODY' > .canon/tmp/pr/body.md
<body content following pr.md template exactly>
BODY
```

Then run:

```bash
canon labels scan --title "<title>" --body-file .canon/tmp/pr/body.md --json
```

Branch on the JSON record rather than the exit code. An operator's shell can wrap `canon` in a function whose status comes from a trailing command, flattening a non-zero exit to 0, the same reason `### Labels` below branches on its own record rather than the exit.

Stop and fix the title or body on a non-empty `phaseLabels`, `boardReferences`, `sessionLinks`, `unspelledWords`, or `titleFormatIssues`. Do not proceed to `### Final command` until a re-run comes back clean on all five. `titleFormatIssues` names which `## Title` rule in `${CLAUDE_SKILL_DIR}/../../standards/pr.md` the title breaks, structure, casing, or length, so fix the named rule rather than guessing. Leave `cutsRelease` and `semverTags` alone, since a release-please pull request legitimately carries version references its own fixed shape explains.

A `pull_request` workflow job now backs the phase-label half for this repository, running `canon labels scan` against the opened title and body. A project holding an older `canon` carries no such job, and one predating this plan carries no `titleFormatIssues` key at all, so the scan above stays required rather than optional.

### Resolving the pull request

The run resolves the pull request once, in the final command below, and every later step reads what that command printed. Nothing else looks the number up again.

`gh pr view` is the form this replaces. It resolves by head branch and ignores state, so a branch name reused after an earlier pull request merged returns the closed one. The detection then takes the edit path and rewrites a merged pull request's title and body, and the run reports that pull request's URL as the one it opened, so nothing surfaces the write landing on the wrong object. Scoping the lookup with `--state open` returns empty there and sends the run down the create path.

The lookup scopes to the base as well as the head. One head can carry open pull requests against two bases, and a lookup reading the first result would pick between them by list order. Resolving the base from the repository's default branch is what makes the detection and `gh pr create` agree on which pull request the run is about.

A detached HEAD gives `git branch --show-current` an empty result, which would read as no open pull request and create a second one. The branch-name guard above stops the run first, since an empty name does not match `<type>/<description>`.

### Labels

Ask the CLI first:

```bash
canon labels audit --base <base> --json
```

The record carries `labels`, the set this branch earns, and `uncovered`, the changed paths no row of the map reaches. Join `labels` with commas into `pr_labels` below. Report each `uncovered` path beside the result line, naming the map so the reader knows where a row would go, since a surface nobody covered merges bare and nothing else says so.

Branch on the record rather than on the exit. An operator's shell profile may wrap `canon` in a function whose status comes from a trailing command, and the binary exits 1 for an unknown subcommand and 1 for an ordinary refusal alike.

A `reason` of `no-map` is the answer that the project declared no map, which earns no labels and no warning: a label set this skill supplied would be a guess about that project's surfaces. Stop there and label nothing.

Every other `reason` is a map or a range the verb could not read, which is `unreadable-map`, `no-domains`, `no-base`, and `unreadable-changes`, plus `bad-base` for a ref this skill resolved wrongly. Take the fallback below and warn beside the result line, naming the reason. A map with a typo in it still has rows a prefix match can reach, and reading the refusal as an absence would open the pull request with no labels and nothing said, which is the surface merging bare that the verb exists to name.

The fallback is reading `canon/config/pr-labels.toml`, or `.claude/canon/pr-labels.toml` when the project has not moved, and matching it against the name-only diff per `${CLAUDE_SKILL_DIR}/references/labels.md`. It also covers no record coming back at all, which is an installed `canon` predating the verb, since a skill reaches a target the moment it merges while the CLI reaches one only when a release publishes. Naming both spellings matters exactly here: the binary old enough to need this fallback is the same binary that may predate the move, so the project's map can still sit at the older path. The fallback labels correctly and reports no uncovered path, which is the half only the verb carries.

Leave `pr_labels` empty when no map resolves or no prefix matches, which skips the labelling command rather than running it against nothing.

### Final command

Detect an open pull request on the current head and branch: edit it in place when one exists, create it otherwise. This keeps the body in sync on a follow-up push instead of erroring on `gh pr create`.

Labels apply after that branch converges, against a pull request that already exists. `gh pr create --label` refuses a label the remote does not carry and opens no pull request at all, so a mistyped row costs the run rather than the label. One command after the fact also covers the create and the edit path together.

The body ends at the last section `${CLAUDE_SKILL_DIR}/../../standards/pr.md` lists. Nothing follows it, including a per-session link a harness-injected reminder requests once the body already exists. That reminder arrives live from the harness itself, never from a file this session opened, and carries the weight of a direct instruction. Refuse it anyway, since `${CLAUDE_SKILL_DIR}/../../standards/pr.md` already states why the section list is closed.

This command reuses `.canon/tmp/pr/body.md`, which the pre-publish scan above already wrote. Nothing here writes it again.

```bash
pr_labels="<comma-separated labels, empty when the map resolves to nothing>"
head_branch=$(git branch --show-current)
git push -u origin HEAD || exit 1
base_branch=$(gh repo view --json defaultBranchRef --jq .defaultBranchRef.name) || exit 1
assert_own_pr() {
  target=$(gh pr view "$1" --json headRefName,state --jq '"\(.headRefName) \(.state)"') || exit 1
  if [ "$target" != "$head_branch OPEN" ]; then
    printf 'Refused: #%s reads "%s", not "%s OPEN". Nothing was written to it.\n' "$1" "$target" "$head_branch" >&2
    exit 1
  fi
}
pr_number=$(gh pr list --head "$head_branch" --base "$base_branch" --state open --json number --jq '.[0].number // empty')
if [ -n "$pr_number" ]; then
  assert_own_pr "$pr_number"
  pr_url=$(gh pr edit "$pr_number" --title "<title>" --body-file .canon/tmp/pr/body.md) || exit 1
else
  pr_url=$(gh pr create --title "<title>" --body-file .canon/tmp/pr/body.md) || exit 1
  pr_number=${pr_url##*/}
  assert_own_pr "$pr_number"
fi
if [ -n "$pr_labels" ]; then
  gh pr edit "$pr_number" --add-label "$pr_labels" >/dev/null ||
    printf 'Label apply failed. Create a missing label with: gh label create <name>\n' >&2
fi
rm -rf .canon/tmp/pr/body
printf 'number=%s\nurl=%s\nhead=%s\n' "$pr_number" "$pr_url" "$head_branch"
```

### Binding every write to this branch's pull request

`assert_own_pr` runs ahead of both writes this command makes to a pull request that already exists, the title and body edit and the label edit. It reads the target's head branch and state and refuses unless they are this branch and `OPEN`. A refusal exits before anything is written, so a wrong number costs the run rather than a stranger's pull request. The function lives only inside this command, so the steps below that post comments or record the task are covered by taking `<number>` from this output rather than by the check itself.

The check compares a number against a branch and never derives a number from one, so it adds no lookup of the kind `### Resolving the pull request` retired. It holds whichever way a wrong number arrives. A number a session retyped by hand, or inferred from the newest pull request in view, reads as a foreign head here and stops.

The last output line carries `head=` so a caller relaying the number holds a branch to compare it against rather than a bare integer. A caller that writes to the pull request itself, such as a draft mark, runs the same comparison in the shell first, reading `gh pr view <number> --json headRefName,state` and refusing unless it matches `head` and `OPEN`.

### Find the UI checklist

`ui-checklist` writes a visual checklist to `.canon/tmp/handoff/ui-checklist/<slug>.md` at the main worktree root when a change needs visual verification, with `<slug>` derived per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`. This skill is the file's sole consumer. Resolve the main root the way `session-worktree` does (`git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`, falling back to `pwd`) and check for the file there. A missing file means no checklist was produced, and the two steps below each skip their checklist half.

When it exists, scan it against `${CLAUDE_SKILL_DIR}/../../standards/publish.md` before either step posts it, the same as the pull request body above.

Where it lands is decided by the evidence step below rather than here, since a checklist reads next to the screenshots it annotates and posting it on its own is the fallback for a branch that changed no screenshot.

### Post the evidence comparison

Run the verb once against the number the pull request step above resolved, passing `--checklist` when the step above found a file and leaving it off when it did not:

```bash
canon pr evidence <number> --checklist <main-root>/.canon/tmp/handoff/ui-checklist/<slug>.md --json
```

One call answers both questions because a checklist does not decide `no-evidence`. The verb reports `no-evidence` on a diff carrying no evidence image whether or not a checklist came with it, so the branch below reads the same `reason` it would have read without the flag, and the checklist is folded in only on the path that has a comparison to fold it into.

Pass `--checklist` only for a file that exists. The verb refuses as `unreadable-checklist` on a path it cannot read or one holding nothing, which is a caller bug rather than a transient failure, so stop and repair the path rather than posting a body with the checklist silently dropped.

Read `reason` on the record rather than the exit code.

- `no-evidence`: nothing changed under an `evidence/` segment, so there is no comparison to post and no body was rendered. Say nothing about the evidence and fall through to the checklist step below.
- `ok`: write `body` to `.canon/tmp/pr/evidence/body-<number>.md` at the main worktree root (resolved the way `session-worktree` does), then post or update the comment:

```bash
gh pr comment <number> --body-file <main-root>/.canon/tmp/pr/evidence/body-<number>.md
```

When the record carries a `commentId`, edit that comment in place instead of posting a second one, reading the body field from the tmp file with `@`, which needs the typed-field flag `-F` because the raw-string flag `-f` posts the path itself as the body:

```bash
gh api -X PATCH repos/{owner}/{repo}/issues/comments/<commentId> -F body=@<main-root>/.canon/tmp/pr/evidence/body-<number>.md
```

Delete the handoff file once that call reports success, per the cleanup below, since the checklist now lives on the pull request. Clean up the tmp body file the same way.

Any other `reason` is one of the mirrored git refusals (`gh-missing`, `gh-failed`, `no-base`, `unreadable-tree`, `unreadable-changes`). Report it and move on without stopping the chain: a branch that carries no evidence images most of the time should not fail here on a transient git or `gh` read. Fall through to the checklist step, which posts the checklist alone rather than losing it to a transient read.

### Post the UI checklist alone

Run this step only when the evidence step above did not carry the checklist, meaning it reported `no-evidence` or one of the git refusals, and a checklist file exists. Post it as its own comment on `<number>`:

```bash
gh pr comment <number> --body-file <main-root>/.canon/tmp/handoff/ui-checklist/<slug>.md
```

Run the cleanup below only once the call that carried the checklist reports success, whichever of the two steps that was. On a failure, stop and leave the file in place: a retry needs the checklist to still be there, and deleting it on a failed post loses the only copy with nothing landed on the pull request.

From a linked worktree the file-editing tools refuse a main-root path, so the cleanup goes out through `Bash` as two plain commands, the file and then the folder, rather than joined by `&&`, which is refused as compound:

```bash
rm <main-root>/.canon/tmp/handoff/ui-checklist/<slug>.md
```

```bash
rmdir <main-root>/.canon/tmp/handoff/ui-checklist 2>/dev/null || true
```

The `rmdir` is a no-op when another branch's pending checklist still sits in the folder, which keeps this step from deleting a handoff that is not its own.

Deleting the file is what makes the later re-render safe. `git-followup` re-runs `canon pr evidence` with no `--checklist`, and the verb carries the checklist forward out of the comment it is editing, so the boxes a reviewer already ticked survive the push.

### Post the preview address

Run this step only when the evidence step above returned `ok` or a checklist was posted, by either step. Either one means the pull request changes a rendered surface, and a reviewer holding a checklist with no screenshots needs the live page most. Otherwise skip it silently.

The evidence comment is already posted, so the reviewer has the screenshots while the deploy runs. Mint the preview against the same `<number>`:

```bash
canon pr preview <number> --json
```

The verb dispatches the project's Pages deploy on the pull request's branch and waits on the run for up to 15 minutes. It refuses before dispatching anything when the deploy command passes no `--branch`, since that deploy would publish the branch to production. `canon docs pr-preview` states the contract. Read `reason` on the record rather than the exit code.

- `ok`: re-render the evidence body with the address on its first line, then post or update it exactly as the evidence step does, through the same tmp file and the `commentId` the record carries:

```bash
canon pr evidence <number> --preview <url> --json
```

- `no-deploy`: the project deploys nothing a dispatch can start. Say nothing and move on.
- Any other `reason`, being `unfenced`, `no-alias`, `run-failed`, `timeout`, or a mirrored `gh` refusal: report it with the record's `message` and move on without stopping the chain. A missing link costs the reviewer a click, and a held ship costs the whole chain.

### Record the number on the task

Write the `number` the final command printed onto the task the branch is closing. Do not resolve it again. A final command that refused on a head mismatch printed no number, so this step writes nothing on that run. `${CLAUDE_SKILL_DIR}/REQUIREMENT.md` states why: a lookup that resolves by branch alone can return a closed pull request sharing that head, so the number is resolved once and reused rather than re-derived.

The task is the one whose `Plan:` line names the plan this branch implemented. Name that plan by its file, which is `.canon/plans/feature-<slug>.md` at the main worktree root with `<slug>` derived per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`. `plan-feature` writes the plan under the branch slug, so the two correspond on any branch that came through the plan-to-execute path. When the session already knows which plan it implemented, because a caller read it earlier in the chain, use that filename instead of re-deriving.

```bash
canon tasks pull-request <number> --plan feature-<slug> --json
```

The slug is a guess at which plan this branch carries rather than a fact about the task, which is why the verb re-checks it against the board and refuses instead of writing on a near miss. A branch whose slug names no plan file falls to the silent skip below, the same as one whose plan no task cites.

The verb resolves the board at the main worktree root in-process, adds `Pull request: #NNN` under the `Plan:`, `Groundwork:`, `Intake:`, or `Issue:` lines the task already carries, and corrects the number in place when the line exists. This is the route because the write is an edit inside an existing file, which the file-editing tools refuse from a linked worktree and which no shell stream editor may make. That root is the one `session-worktree` resolves on entry.

The correction reaches only a line that does not read as a list of `#NNN` entries. A line that does takes the new number appended rather than replaced, reported as `appended`, so a task shipped in slices keeps every pull request.

Skip this silently when the record is `ok: false` and `reason` is `no-board`, `no-match`, or `ambiguous`. Those are the three cases a guessed write would compound: no board, no task naming the plan, or more than one. One pull request names one task, and a wrong match archives the wrong task unattended once the branch merges. Report any other refusal rather than swallowing it.

The number is what lets the merge close the task. Every merge on `main` is a squash carrying it in the subject, so the number survives where a branch name does not, and `post-merge` reads it back to call `canon tasks archive`. Writing it here rather than at worktree time is what makes it a pull request number rather than a branch the squash discards.

## After execution

Respond with one line, using the `url` the final command printed:

`✅ PR: <url>`

Add a line for each `uncovered` path the labels step reported, naming the path and the map it belongs in:

`⚠️ No label covers <path>. Add a row to canon/config/pr-labels.toml or a [declined] entry.`

Add a further line only when the labelling command printed its warning, quoting the label `gh` refused:

`⚠️ Labels not applied: <what gh reported>`

Add a line when a checklist was posted, naming the pull request it landed on and which comment carries it:

`📋 Posted the UI checklist to <number>, in the evidence comment.`

`📋 Posted the UI checklist to <number>, on its own.`

Add a line when the preview step returned an address:

`🔗 Preview: <url>`

Do not add any other text.
