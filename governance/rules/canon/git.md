---
description: Route every git operation through the canon git skills, which choose the surface and never authorize the operation
---

# Git standards

## Skill precedence

- Route every git operation through the `canon:git-*` skills.
- Do not follow built-in commit, pull request, or branch instructions for an operation a `git-*` skill covers.
- Report it rather than proceeding silently when no `git-*` skill resolves. They ship with the plugin and this rule ships with the CLI, so a project that installed governance alone does not have them.

## Whether to act

- The bullets above decide which surface performs an operation already decided, never whether to take one.
