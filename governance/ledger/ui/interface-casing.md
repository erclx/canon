---
title: Interface casing rule ledger
description: Sources for governance/rules/ui/interface-casing.md, one row per bullet
---

# Interface casing rule ledger

The field is content design, and the authority is the GOV.UK style guide, which sets sentence case for every heading and title. The label count and the scope bullets are canon's own.

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

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Cut without a check

- Cut "treat the count as a judgment, since a glob cannot check it", which tells a session nothing it can verify against a line.

### Merged or reworded

- Folded "treat title case on every heading as a template tell" into the sentence case bullet as its reason.
- Shortened the uppercase label bullet under 200 characters, keeping the `ceil(sections / 3)` count and the delete remedy.
- Reworded the scope bullet from a statement of what the rule covers to the directive a session can act on.
