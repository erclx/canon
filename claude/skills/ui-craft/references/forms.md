# Form standards

## Validation timing

- Validate when the person submits or continues, never when focus leaves a field. Realtime feedback the feature exists for, such as a character count, is the exception.
- Re-validate a field on every change once it shows an error, so the error clears as soon as the input is valid.

## Submission

- Refuse a submit while a required field is empty, whitespace-only, or invalid, and show each error. Keep the submit button enabled rather than disabling it.

## Error placement

- Show each error next to the field that caused it, never under an unrelated field.
- Show a cross-field conflict under the field the person edited, not under the field it conflicts with.
- Move focus to an error summary linking to each failing field when a submission fails, and keep the inline error beside each field.

## Authentication and re-entry

- Let a password manager fill sign-in fields and accept a pasted value. Never block paste or autofill on a password or code field (WCAG 3.3.8).
- Never ask again for information the person gave earlier in the same flow. Prefill it or offer it for selection (WCAG 3.3.7).

## Input sanitization

- Trim leading and trailing whitespace from a text input on submit, never on every keystroke.
- Say near a case-sensitive field that it is case-sensitive, rather than silently treating `Foo` and `foo` as different values.

## Derived display state

- Reset a status indicator, count, or derived value to neutral when its source input changes.
