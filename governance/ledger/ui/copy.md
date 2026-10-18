---
title: UI copy rule ledger
description: Sources for governance/rules/ui/copy.md, one row per bullet
---

# UI copy rule ledger

The field is content design, and the authority for researched interface copy is the GOV.UK Design System and its style guide.

## Punctuation

| Bullet                        | Source                                                                                                                                                                  | Read       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| No em dash or semicolon       | House choice: both read as generated copy in an interface, and a comma, a period, or a split sentence carries the same meaning in a shorter line                        | 2026-10-18 |
| No trailing label punctuation | [Button](https://design-system.service.gov.uk/components/button/): every example label, such as "Start now", "Sign in", and "Continue", carries no trailing punctuation | 2026-10-18 |

## Button copy

| Bullet            | Source                                                                                                                                     | Read       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| The action's verb | [Button](https://design-system.service.gov.uk/components/button/): "Write button text in sentence case, describing the action it performs" | 2026-10-18 |

## Error messages

| Bullet            | Source                                                                                                                                                                                                                                            | Read       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Say how to fix it | [Error message](https://design-system.service.gov.uk/components/error-message/): "Describe what has happened and tell them how to fix it", and "'Enter your first name' is clearer, more direct and natural than 'First name must have an entry'" | 2026-10-18 |
| Short and plain   | [Error message](https://design-system.service.gov.uk/components/error-message/): "The message must be in plain English, use positive language and get to the point", with no "technical jargon like 'form post error'"                            | 2026-10-18 |

## Placeholder text

| Bullet                         | Source                                                                                                                                                                                                                                           | Read       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| No placeholder, a hint instead | [Text input](https://design-system.service.gov.uk/components/text-input/): "Do not use placeholder text in place of a label, or for hints or examples", since "it vanishes when the user starts typing" and "not all screen readers read it out" | 2026-10-18 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Contradicted by the source

- Replaced "show format examples over instructions in placeholder text" with the hint text bullet, since GOV.UK says not to use a placeholder "for hints or examples".
- Cut "reserve instructions for labels or helper text", which the new placeholder bullet now carries.

### Merged or reworded

- Merged the imperative verb and padded phrasing bullets. The `Save` over `Save changes` example went, since GOV.UK adds words "to better describe the action".
- Merged "keep messages short and actionable" and "one sentence maximum" into the plain language bullet.
- Reworded the error example to `Enter an email address`, the instruction form GOV.UK prefers over a description.
