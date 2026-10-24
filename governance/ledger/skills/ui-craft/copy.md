---
title: UI copy reference ledger
description: Sources for claude/skills/ui-craft/references/copy.md, one row per bullet
---

# UI copy reference ledger

The reference joins three rules, and its sections keep their order, so each source below covers a run of them.

Content design governs the first four sections, where the authority for researched interface copy is the GOV.UK Design System and its style guide.

The four casing sections rest on the GOV.UK style guide, which sets sentence case for every heading and title, and canon set the label count and the scope bullets itself. The two link sections are interaction design, sourced from the Nielsen Norman Group's research on new windows and tabs.

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

## Sentence case

| Bullet                   | Source                                                                                                                                                      | Read       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Sentence case            | [A to Z of GOV.UK style](https://www.gov.uk/guidance/style-guide/a-to-z-of-gov-uk-style): "Always use sentence case, even in page titles and service names" | 2026-10-18 |
| Proper nouns keep casing | [A to Z of GOV.UK style](https://www.gov.uk/guidance/style-guide/a-to-z-of-gov-uk-style): "The exceptions to this are proper nouns"                         | 2026-10-18 |

## Uppercase labels

| Bullet      | Source                                                                                                                                                       | Read       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Label count | House choice: an uppercase eyebrow over every section is the template tell `design-taste` reaches past, and the count makes the cap checkable against a page | 2026-10-18 |

## Where it applies

| Bullet                 | Source                                                                                                           | Read       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------- |
| Copy outside the globs | House choice: a locale file holds the same rendered strings, so title case there ships with no rule firing on it | 2026-10-18 |

## Overriding

| Bullet              | Source                                                                                                                                        | Read       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Depart where needed | House choice: an acronym or brand mark lowered to sentence case misnames it, the same reason GOV.UK keeps "proper nouns" as its one exception | 2026-10-18 |

## Default target

| Bullet                      | Source                                                                                                                                                                                                                                                                                           | Read       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Same tab, new tab by task   | [Opening links in new browser windows and tabs](https://www.nngroup.com/articles/new-browser-windows-and-tabs/): "There is generally one good reason to open a page in a new window, and that is that the user will need to refer to that content in order to complete a task in another window" | 2026-10-18 |
| No blanket external new tab | [Opening links in new browser windows and tabs](https://www.nngroup.com/articles/new-browser-windows-and-tabs/): "New windows or tabs prevent the use of the Back button" and "can cause disorientation"                                                                                         | 2026-10-18 |

## mailto: links

| Bullet             | Source                                                                                                                                       | Read       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `mailto:` same tab | House choice: the link opens the mail client and leaves the page in place, so `target="_blank"` only adds an empty tab the person must close | 2026-10-18 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Contradicted by the source

- Replaced "show format examples over instructions in placeholder text" with the hint text bullet, since GOV.UK says not to use a placeholder "for hints or examples".
- Cut "reserve instructions for labels or helper text", which the new placeholder bullet now carries.

### Merged or reworded

- Merged the imperative verb and padded phrasing bullets. The `Save` over `Save changes` example went, since GOV.UK adds words "to better describe the action".
- Merged "keep messages short and actionable" and "one sentence maximum" into the plain language bullet.
- Reworded the error example to `Enter an email address`, the instruction form GOV.UK prefers over a description.
- Folded "treat title case on every heading as a template tell" into the sentence case bullet as its reason.
- Shortened the uppercase label bullet under 200 characters, keeping the `ceil(sections / 3)` count and the delete remedy.
- Reworded the scope bullet from a statement of what the rule covers to the directive a session can act on.

### Cut without a check

- Cut "treat the count as a judgment, since a glob cannot check it", which tells a session nothing it can verify against a line.

### Rewritten to what the source says

- Reworded the new tab exception from "a destination that would discard in-progress work" to a page the person must consult while finishing a task, the one reason NN/g names.
