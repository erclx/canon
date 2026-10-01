---
name: bash-cli-script
description: Generates a small non-interactive Bash wrapper for automation, CI, and agent-run tasks, with strict mode, logs on stderr, a clean stdout, and explicit exit codes. Stops at 100 lines and routes the work to TypeScript on Bun. Use when asked for "a shell script", "a wrapper script", an automation or CI script, a cron job, or a pipeline helper. Do NOT use for a tool that prompts a person or draws a terminal UI, or for a script that will run past 100 lines. Both are written in TypeScript on Bun.
---

# Bash CLI script

Generate small non-interactive Bash wrappers for automation, CI, and agent-run workflows. Shell is for small utilities and simple wrappers, and anything larger is written in TypeScript on Bun, which runs a script about as fast as bash starts one.

Load `${CLAUDE_SKILL_DIR}/references/template.md` for the base skeleton. Copy it and keep only what the task needs.

## Guards

- Estimate the script's length before writing any of it. When it will run past 100 lines, stop and write it in TypeScript on Bun instead, saying the threshold is the one the [Google Shell Style Guide](https://google.github.io/styleguide/shellguide.html) sets: "If you are writing a script that is more than 100 lines long ... you should rewrite it in a more structured language now". Stopping after generating wastes the draft and leaves a long script to argue against.
- A request for interactive prompts, a framed timeline, icons, or color stops the same way. Say that a tool a person drives is past what a wrapper is for, and offer the TypeScript route rather than generating a script with prompts.
- Editing an existing shell file already over 100 lines is not a new script. Edit it in place without growing it, and flag it for a rewrite rather than rewriting it on contact.

## Script setup

- Start with `#!/usr/bin/env bash` and `set -euo pipefail`.
- Do not rely on unset variables. Use `${VAR:-default}`.

## Output contract

- Write data to stdout. Write logs, progress, and errors to stderr.
- Keep stdout clean so the script composes in a pipe.
- Do not emit timeline frames, icons, or color.

## Error handling

- Define `die()` that prints an error to stderr and exits non-zero.
- Include actionable context in error messages.
- Guard commands that return non-zero on a valid empty result with `|| true`.
- Set explicit exit codes. Reserve 0 for success.
- Read a called command's machine-readable record where it emits one. An exit status separates success from failure and never names which failure, so a script routing on the reason reads the record and keeps the exit for the pass-fail decision alone.

## Code style

- Quote variables in expansions and test brackets.
- Comment only a fact the reader cannot recover from the code, and follow the code-comment rule in `.claude/rules/` when the project installs it.
- Use 2-space indentation.

## Validation

Before responding, verify:

- The script is 100 lines or fewer.
- File starts with `#!/usr/bin/env bash` and `set -euo pipefail`.
- Data goes to stdout, logs and errors go to stderr.
- No timeline frames, icons, or interactive prompts.
- Errors exit non-zero with context through `die()`.
