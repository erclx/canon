---
description: Enforce the same-tab default for an outbound link and for a mail link
paths:
  - '**/*.tsx'
  - '**/*.jsx'
  - '**/*.astro'
  - '**/*.html'
---

# Link behavior standards

## Default target

- Open a link in the same tab. Reserve `target="_blank"` for a page the person must consult while finishing a task in the current one.
- Never add `target="_blank"` as a default for every external link.

## mailto: links

- Open a `mailto:` link in the same tab. It hands off to the mail client rather than replacing the page, so a new tab leaves an empty tab behind.
