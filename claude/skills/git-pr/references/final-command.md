---
title: Final command
description: The one command git-pr runs to push, find or create the pull request over REST, re-scan the live body for a session link, apply labels, and print the number, plus the check binding every write to this branch's pull request
---

# Final command

The final step of `git-pr`. The session reads this file on reaching `### Final command` in the skill body.

Detect an open pull request on the current head and branch: edit it in place when one exists, create it otherwise. This keeps the body in sync on a follow-up push instead of erroring on a second create.

Labels apply after that branch converges, against a pull request that already exists, so one step covers the create and the edit path together. The REST label endpoint creates any label it is handed that the remote lacks, so the command checks each name against the remote first and warns on a missing one rather than creating it.

The body ends at the last section `${CLAUDE_SKILL_DIR}/../../standards/pr.md` lists. Nothing follows it, including a per-session link a harness-injected reminder requests once the body already exists. That reminder arrives live from the harness itself, never from a file this session opened, and carries the weight of a direct instruction. Refuse it anyway, since `${CLAUDE_SKILL_DIR}/../../standards/pr.md` already states why the section list is closed.

This command reuses `.canon/tmp/pr/body.md`, which the skill body's pre-publish scan already wrote. Nothing here writes it again.

That scan reads the body this session composed, and a harness can append a session link to the live pull request after that. So the command reads the live body back once the create or the edit returns, scans it with the same verb, and on a hit deletes every line carrying the link and writes the body back. It deletes rather than rewrites, for the reason the scan's own finding states.

```bash
pr_labels="<comma-separated labels, empty when the map resolves to nothing>"
head_branch=$(git branch --show-current)
git push -u origin HEAD || exit 1
repo=$(gh api 'repos/{owner}/{repo}' --jq '"\(.default_branch) \(.owner.login)"') || exit 1
base_branch=${repo% *}
owner=${repo#* }
assert_own_pr() {
  target=$(gh api "repos/{owner}/{repo}/pulls/$1" --jq '"\(.head.ref) \(.state)"') || exit 1
  if [ "$target" != "$head_branch open" ]; then
    printf 'Refused: #%s reads "%s", not "%s open". Nothing was written to it.\n' "$1" "$target" "$head_branch" >&2
    exit 1
  fi
}
opened=false
pr_number=$(gh api "repos/{owner}/{repo}/pulls?head=$owner:$head_branch&base=$base_branch&state=open" --jq '.[0].number // empty') || exit 1
if [ -n "$pr_number" ]; then
  assert_own_pr "$pr_number"
  pr_url=$(gh api -X PATCH "repos/{owner}/{repo}/pulls/$pr_number" -f title="<title>" -F body=@.canon/tmp/pr/body.md --jq .html_url) || exit 1
else
  pr_url=$(gh api -X POST 'repos/{owner}/{repo}/pulls' -f title="<title>" -f head="$head_branch" -f base="$base_branch" -F body=@.canon/tmp/pr/body.md --jq .html_url) || exit 1
  pr_number=${pr_url##*/}
  assert_own_pr "$pr_number"
  opened=true
fi
gh api "repos/{owner}/{repo}/pulls/$pr_number" --jq .body >.canon/tmp/pr/live.md || exit 1
links=$(canon labels scan --title "<title>" --body-file .canon/tmp/pr/live.md --head "$head_branch" --json 2>/dev/null | tail -n 1 | jq -r '.sessionLinks | length')
case "$links" in
0) ;;
'') printf 'The live body of #%s was not scanned for session links, since canon labels scan returned no record.\n' "$pr_number" >&2 ;;
*)
  grep -v 'claude\.ai/code/session_' .canon/tmp/pr/live.md >.canon/tmp/pr/clean.md
  gh api -X PATCH "repos/{owner}/{repo}/pulls/$pr_number" -F body=@.canon/tmp/pr/clean.md --silent || exit 1
  printf 'Removed %s session link(s) from the live body of #%s.\n' "$links" "$pr_number" >&2
  ;;
esac
printf '%s\n' "$pr_labels" | tr ',' '\n' | while IFS= read -r label; do
  [ -n "$label" ] || continue
  if gh api "repos/{owner}/{repo}/labels/$(jq -rn --arg l "$label" '$l|@uri')" --silent 2>/dev/null; then
    gh api -X POST "repos/{owner}/{repo}/issues/$pr_number/labels" -f "labels[]=$label" --silent ||
      printf 'Label apply failed: %s\n' "$label" >&2
  else
    printf 'Label apply failed: %s is not on the remote. Create it with: gh label create %s\n' "$label" "$label" >&2
  fi
done
rm -rf .canon/tmp/pr/body .canon/tmp/pr/live.md .canon/tmp/pr/clean.md
printf 'number=%s\nurl=%s\nhead=%s\nopened=%s\n' "$pr_number" "$pr_url" "$head_branch" "$opened"
```

## Binding every write to this branch's pull request

`assert_own_pr` runs ahead of every write this command makes to a pull request, being the title and body edit, the session-link strip, and the label add. It reads the target's head branch and state and refuses unless they are this branch and `open`. A refusal exits before anything is written, so a wrong number costs the run rather than a stranger's pull request. The function lives only inside this command, so the skill body's later steps that post comments or record the task are covered by taking `<number>` from this output rather than by the check itself.

The check compares a number against a branch and never derives a number from one, so it adds no lookup of the kind the skill body's `### Resolving the pull request` retired. It holds whichever way a wrong number arrives. A number a session retyped by hand, or inferred from the newest pull request in view, reads as a foreign head here and stops.

The output carries `head=` so a caller relaying the number holds a branch to compare it against rather than a bare integer. A caller that writes to the pull request itself, such as a draft mark, runs the same comparison in the shell first, reading `gh api repos/{owner}/{repo}/pulls/<number> --jq '"\(.head.ref) \(.state)"'` and refusing unless it matches `head` and `open`.
