---
description: Enforce UI copy and text standards for rendered strings in components
paths:
  - '**/*.tsx'
  - '**/*.jsx'
  - '**/*.astro'
  - '**/*.html'
---

# UI copy standards

## Punctuation

- Write no em dash (`—`) or semicolon in rendered copy. Use a comma or a period, or restructure the sentence.
- Add no trailing punctuation to a button label or a short action string.

## Button copy

- Label a button with the verb of the action it performs, such as `Save` or `Delete`, never with filler such as `Click to delete`.

## Error messages

- Tell the person how to fix the error, such as `Enter an email address` over `Email is invalid`.
- Keep an error message to one short sentence in plain language, with no technical jargon or error codes.

## Placeholder text

- Never use placeholder text as a label, a hint, or an example. Put a format example such as `name@example.com` in hint text under the label.
