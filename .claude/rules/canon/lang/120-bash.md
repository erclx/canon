---
description: Route bash script authoring to the wrapper skill, and name the lint gate
paths:
  - '**/*.sh'
---

# Bash standards

## Skill routing

- Use `canon:bash-cli-script` before writing a script, and follow its guards on what a shell script may be.
- Load the skill's own reference template rather than hand-rolling logging patterns outside it.
- Report it rather than proceeding silently when the skill does not resolve. It ships with the plugin and this rule ships with the CLI, so a project that installed governance alone does not have it.

## Lint gate

- Format with `shfmt --write --indent 2` and lint with `shellcheck --severity=warning` before committing a script.
- Fix a shellcheck finding at the source. Suppress one with a directive comment only for a genuine false positive, and state why beside the suppression.
