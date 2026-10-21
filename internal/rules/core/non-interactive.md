---
description: Enforce headless behavior for pickers and prompts in commands and scripts
paths:
  - 'src/**/*.ts'
  - 'scripts/**/*.sh'
---

# Non-interactive standards

## Picker defaults

- List the option a headless caller should get first, since `select` in `src/cli/ui.ts` returns it when `nonInteractiveDefault` is set and stdin is not a terminal.
- Never list a review or preview option first, which sends agents down an interactive branch.
- Refuse headlessly when a picker stands in for a required argument. Return 1 with the valid names rather than defaulting, which picks a whole stack or category for the caller.
- Keep `nonInteractiveDefault` on a confirm-then-apply prompt, where the caller has already named what to apply and the apply is additive.
- Drop it when the apply replaces a file the project owns, since naming a stack is not consent to lose an edit inside it.
- Give a destructive prompt an explicit `--write` and refuse headlessly without one, in the shape of `canon tooling sync`.
