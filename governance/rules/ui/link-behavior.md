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

- Open a link in the same tab. Reserve `target="_blank"` for a destination that would discard in-progress work if it replaced the current page, such as a document a user is midway through elsewhere.
- Do not add `target="_blank"` as a default for every external link.

## mailto: links

- Open a `mailto:` link in the same tab. It hands off to the mail client rather than replacing page content, so a new tab leaves an empty tab behind.
