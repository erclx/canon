---
title: Independent split commands
description: The final commands git-split runs in independent mode, basing every new branch on main and opening each pull request over REST
---

# Independent split commands

Applies to a `git-split` run whose preview reads `Mode: Independent`. Every branch is based on `main`, since each group's commits apply there without the others.

## Final commands

```bash
# Rename current branch to reflect primary concern
git branch -m <current_branch> <new_name>

# Create, cherry-pick, push, and open PR for each secondary branch
mkdir -p .canon/tmp/pr/split
git switch -c <branch> main && git cherry-pick <sha> <sha> \
  && git push -u origin <branch> \
  && (cat <<'BODY' > .canon/tmp/pr/split/<branch>.md
<body following pr.md template, written from the cherry-picked commits>
BODY
) && gh api -X POST 'repos/{owner}/{repo}/pulls' -f title="<title>" -f head=<branch> -f base=main -F body=@.canon/tmp/pr/split/<branch>.md --jq .html_url \
  && printf 'opened=true\n' \
  && rm .canon/tmp/pr/split/<branch>.md

# Return to primary branch, push, and open its PR
git checkout <new_name> && git push -u origin <new_name> \
  && (cat <<'BODY' > .canon/tmp/pr/split/<new_name>.md
<body following pr.md template, written from the primary's commits>
BODY
) && gh api -X POST 'repos/{owner}/{repo}/pulls' -f title="<title>" -f head=<new_name> -f base=main -F body=@.canon/tmp/pr/split/<new_name>.md --jq .html_url \
  && printf 'opened=true\n' \
  && rm .canon/tmp/pr/split/<new_name>.md

# Clean up the body-file dir if all PRs succeeded (no-op when non-empty)
rmdir .canon/tmp/pr/split 2>/dev/null || true
```

Repeat the secondary block once per secondary branch. The skill body states why each create goes through the REST endpoint and what `opened=true` marks.
