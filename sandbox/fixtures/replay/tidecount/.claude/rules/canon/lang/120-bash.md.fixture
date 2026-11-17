---
description: Route bash script authoring to the interactive or non-interactive skill, and name the lint gate
paths:
  - '**/*.sh'
---

# Bash standards

## Skill routing

- Use `canon:bash-script` for an interactive or human-facing script: prompts, a visual timeline UI, framed terminal output.
- Use `canon:bash-cli-script` for a non-interactive script: automation, CI, cron, a pipeline helper, or anything run by an agent rather than watched by a person.
- Load the matched skill's own reference templates rather than hand-rolling interactivity or logging patterns outside them.
- Report it rather than proceeding silently when the matched skill does not resolve. Both ship with the plugin and this rule ships with the CLI, so a project that installed governance alone does not have them.

## Lint gate

- Format with `shfmt --write --indent 2` and lint with `shellcheck --severity=warning` before committing a script.
- Fix a shellcheck finding at the source. Suppress one with a directive comment only for a genuine false positive, and state why beside the suppression.
