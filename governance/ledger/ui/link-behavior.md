---
title: Link behavior rule ledger
description: Sources for governance/rules/ui/link-behavior.md, one row per bullet
---

# Link behavior rule ledger

The field is interaction design, and the authority is the Nielsen Norman Group's research on new windows and tabs.

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

### Rewritten to what the source says

- Reworded the new tab exception from "a destination that would discard in-progress work" to a page the person must consult while finishing a task, the one reason NN/g names.
