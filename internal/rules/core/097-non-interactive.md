---
description: Enforce headless behavior for pickers and prompts in commands and scripts
paths:
  - 'src/**/*.ts'
  - 'scripts/**/*.sh'
  - 'sandbox/**/*.sh'
---

# Non-interactive standards

## Picker defaults

- List the option a headless caller should get first. `select_option` returns its first option under `CANON_NON_INTERACTIVE=1`, so a review or preview option placed first sends agents down an interactive branch.
- Refuse headlessly when a picker stands in for a required argument. Return 1 with the valid names rather than defaulting, which picks a whole stack or category for the caller.
- Keep `nonInteractiveDefault` on a confirm-then-apply prompt, where the caller has already named what to apply and the apply is additive.
- Drop it when the apply replaces a file the project owns. Naming a stack is not consent to lose an edit inside it, so a destructive prompt takes an explicit `--write` and refuses headlessly without one. `canon tooling sync` is the shape to copy.
