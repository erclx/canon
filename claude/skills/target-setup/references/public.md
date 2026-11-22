---
title: Public fixups
description: The identity fill and the private vulnerability reporting offer a public run applies once the public layer has synced
---

# Public fixups

What the `install` phase does after `canon tooling sync public` lands. A private run reads none of this.

## Fill the identity

Fill the five identity tokens the public seeds carry, each from the source the table names. Replace those five names and touch no other angle-bracket token, since `CONTRIBUTING.md` carries `<type>(<scope>): <subject>` as literal commit header text.

| Token               | Source                                                               |
| ------------------- | -------------------------------------------------------------------- |
| `<owner>`, `<repo>` | The GitHub `origin` remote, read through `git remote get-url origin` |
| `<project>`         | The repository name, once `<repo>` resolves                          |
| `<year>`            | `date +%Y`                                                           |
| `<holder>`          | `git config user.name`                                               |

Setup often runs before the remote exists. Ask for the owner and the repository name on an attended run, and leave those tokens on a headless one. Never guess them from the folder name.

Then list what is left for the operator. Read the synced files for each remaining `<token>`, leave out the commit header format line, and carry each one with its file and line into the report.

## Private vulnerability reporting

The seeded security policy points readers to GitHub private vulnerability reporting, which is off on a new repository. With a GitHub remote, offer to switch it on through the structured question surface, then read the setting back.

```bash
gh api -X PUT repos/<owner>/<repo>/private-vulnerability-reporting
gh api repos/<owner>/<repo>/private-vulnerability-reporting --jq .enabled
```

- Name the `PUT` command as a follow-up rather than running it when no GitHub remote exists, when the run is headless, or when the operator declines
- Report a read back other than `true` as a failed switch, never as on

## Report

A public run owes the operator two lines beside the setup report.

- Each placeholder left, with its file and line
- The reporting switch as on, failed, or a named follow-up
