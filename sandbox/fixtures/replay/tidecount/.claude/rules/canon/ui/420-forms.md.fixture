---
description: Form validation timing, save-blocking, and derived state for rendered forms
paths:
  - '**/*.tsx'
  - '**/*.jsx'
  - '**/*.astro'
  - '**/*.html'
---

# Form standards

## Validation timing

- Validate on blur, not on every keystroke. Exception: realtime feedback that is explicitly part of the feature (e.g. character count, live search).
- After a field shows its first error (on blur), re-validate on every change so the error clears as soon as the input becomes valid.
- Apply the same validation timing to all fields in a form. Do not mix blur-only and change-only validation within one form.
- Do not show an error on a field the user has never touched.

## Save blocking

- Block save when any required field is empty, invalid, or has never been touched.
- Treat whitespace-only values as empty for required fields.

## Error placement

- Show the error directly under the field that caused it, not under an unrelated field.
- When a change to field A causes a conflict involving field B, show the error under field A (the field the user edited), not under field B.

## Input sanitization

- Trim leading and trailing whitespace from text inputs on blur or submit, not on every keystroke.
- If a field is case-sensitive, surface that constraint near the field. Do not silently treat `Foo` and `foo` as different values without warning.

## Derived display state

- Reset status indicators, counts, and derived display values when their source input changes.
