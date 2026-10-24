---
title: Forms reference ledger
description: Sources for claude/skills/ui-craft/references/forms.md, one row per bullet
---

# Forms reference ledger

The field is form design inside interaction design, and the authority for researched form patterns is the GOV.UK Design System, with WCAG 2.2 for the two authentication criteria. NN/g was read beside it and disagrees on validation timing, recorded under `## Declined`.

## Validation timing

| Bullet                     | Source                                                                                                                                                                                                            | Read       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Validate on submit         | [Recover from validation errors](https://design-system.service.gov.uk/patterns/validation/): "Do not validate when the user moves away from a field. Wait until they try to move to the next part of the service" | 2026-10-18 |
| Re-validate after an error | House choice: an error left in place after the input turns valid tells the person their correct answer is still wrong, and they edit a field that needed nothing                                                  | 2026-10-18 |

## Submission

| Bullet                            | Source                                                                                                                                                                                                                                                                                                    | Read       |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Refuse with errors, never disable | [Button](https://design-system.service.gov.uk/components/button/): "Disabled buttons have poor contrast and can confuse some users, so avoid them if possible", and [validation](https://design-system.service.gov.uk/patterns/validation/) refuses "missing information, if the information is required" | 2026-10-18 |

## Error placement

| Bullet                                | Source                                                                                                                                                                                         | Read       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Error next to its field               | [Error message](https://design-system.service.gov.uk/components/error-message/): "Show an error message next to the field and in the Error summary component when there is a validation error" | 2026-10-18 |
| Cross-field error on the edited field | House choice: an error under the field the person did not touch sends them to change a value they meant, rather than the one they just entered                                                 | 2026-10-18 |
| Focus to a linked summary             | [Error summary](https://design-system.service.gov.uk/components/error-summary/): "move keyboard focus to the error summary" and "link to each of the answers that have validation errors"      | 2026-10-18 |

## Authentication and re-entry

| Bullet                   | Source                                                                                                                                                                                                                                                                                         | Read                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Allow paste and autofill | [Understanding Accessible Authentication (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html): mechanisms that satisfy it include "support for password entry by password managers" and "copy and paste to reduce the cognitive burden of re-typing" | 2026-10-18, WCAG 2.2 |
| No redundant entry       | [Understanding Redundant Entry](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html): information previously entered in the same process is "either auto-populated, or available for the user to select"                                                                          | 2026-10-18, WCAG 2.2 |

## Input sanitization

| Bullet                        | Source                                                                                                                                                                                                                                                                    | Read       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Trim on submit                | [Recover from validation errors](https://design-system.service.gov.uk/patterns/validation/): "Use validation to ignore unwanted characters", such as spaces entered "before or after" an answer, since an error over one "would be difficult for the user to see and fix" | 2026-10-18 |
| Say a field is case-sensitive | House choice: a value rejected or duplicated on case alone fails with no visible reason, since `Foo` and `foo` read as the same answer                                                                                                                                    | 2026-10-18 |

## Derived display state

| Bullet                        | Source                                                                                                                                                       | Read       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Reset derived state on change | House choice: a status, count, or result left from the previous input reports on a value the field no longer holds, such as a "connected" dot for an old URL | 2026-10-18 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Contradicted by the source

- Replaced "validate on blur" with validation on submit, since GOV.UK says "Do not validate when the user moves away from a field".
- Kept GOV.UK over NN/g's [form errors guidelines](https://www.nngroup.com/articles/errors-forms-design-guidelines/), which favor validation "as soon as the user has finished filling in a field".
- Replaced "block save when a required field is empty or invalid" with the submission bullet. Read as a disabled button, it contradicts GOV.UK.

### Made redundant by the rewrite

- Cut "apply the same validation timing to all fields in a form", since validating on submit gives every field one timing.
- Cut "do not show an error on a field the user has never touched", since no error shows before a submit.

### Merged or reworded

- Merged "treat whitespace-only values as empty for required fields" into the submission bullet.
- Merged the `## Submission errors` H2 into `## Error placement`, which took the form to 6 H2s.
- Reworded "under the field" to "next to the field", since GOV.UK places the message between the label and the input.
- Took in the status indicator reset from `ux-completeness.md`, so the reset has one copy.
