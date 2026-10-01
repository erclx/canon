---
name: bash-cli-script
description: What a small non-interactive shell wrapper owes its caller, and the 100-line threshold past which the work belongs in TypeScript on Bun
---

# Bash CLI script requirement

## Gap

Without this skill, a wrapper is written with an interactive tool's habits. Progress lines, icons, and color land on stdout, so the script stops composing in a pipe and the caller parses a spinner as data. The failure is invisible in a terminal and total in CI.

The robustness failures are the ones that reach production. Without strict mode a failed stage inside a pipe exits zero and the script reports success on work that did not happen. An unset variable expands to nothing and a path built from it points somewhere nobody meant.

The size failure is the slow one. A shell script that keeps growing past a wrapper's job turns into the long file nobody will touch, and the [Google Shell Style Guide](https://google.github.io/styleguide/shellguide.html) puts the line at 100: past it, the script is rewritten in a more structured language. Without a stop before generating, a session writes the long script first and the rewrite never happens.

## Must

- Stop before generating when the script will run past 100 lines, and route the work to TypeScript on Bun citing the style guide
- Stop the same way on a request for prompts or a terminal UI, saying why
- Open with the strict-mode preamble, so a failed stage stops the script
- Keep data on stdout and put every log line, progress message, and error on stderr
- Exit non-zero with actionable context through one error helper
- Default every variable expansion rather than relying on it being set
- Guard a command that returns non-zero on a valid empty result
- Run the validation list before responding

## Must not

- Emit timeline frames, icons, color, or an interactive prompt
- Put a log or progress line on stdout
- Comment what the code already states
- Rewrite an existing long shell file on contact, which is a rewrite decision rather than an edit

## Guards

- A script that will run past 100 lines stops before any of it is written, and the session writes it in TypeScript on Bun instead.
- A request for prompts, a framed timeline, icons, or color stops with the same route.

## Out of scope

- A tool a person drives through prompts or a terminal UI, which is written in TypeScript on Bun
- A GitHub Actions workflow file, which `ci-workflow` owns
- Running, installing, or scheduling what it generates
