---
title: Codebase layout skill ledger
description: Sources for claude/skills/codebase-layout/SKILL.md, one row per bullet in its concern groups
---

# Codebase layout skill ledger

The field is source organization. Robert Martin carries cohesion and folder naming, Kent C. Dodds and Robin Wieruch carry colocation and promotion, bulletproof-react carries the import direction, and the Go blog carries file and package naming. The closing sections and `## What this delegates` restate these rules or route, so they take no table.

No outside source takes a side on when a plan states a path, so the rows for stating a reason, naming a new folder, and reading a reference are house choices naming the misplacement each prevents.

## Read the project's strategy first

| Bullet                                | Source                                                                                                                                                                                                          | Read       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Name the project's layout first       | [React, File Structure](https://legacy.reactjs.org/docs/faq-structure.html): "React doesn’t have opinions on how you put files into folders", so the project's own layout is the only one a new file can follow | 2026-10-24 |
| Keep to that strategy                 | [Next.js, Project structure](https://nextjs.org/docs/app/getting-started/project-structure): "choose a strategy that works for you and your team and be consistent across the project"                          | 2026-10-24 |
| A strategy change is its own decision | House choice: a strategy changed as a side effect of placing one file leaves two strategies in the tree, and every later reader guesses which one a file follows                                                | 2026-10-24 |

## Group what changes together

| Bullet                              | Source                                                                                                                                                                                                                                                     | Read       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| One folder per reason to change     | [Martin, The Single Responsibility Principle](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html): "Gather together the things that change for the same reasons. Separate those things that change for different reasons." | 2026-10-24 |
| Name a folder for what it holds     | [Martin, Screaming Architecture](https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html): "Your architectures should tell readers about the system, not about the frameworks you used in your system."                               | 2026-10-24 |
| No bare `utils` or `helpers` bucket | [Gerrand, Package names](https://go.dev/blog/package-names): "Packages named util , common , or misc provide clients with no sense of what the package contains."                                                                                          | 2026-10-24 |

## Name a file for what it covers inside its folder

| Bullet                                 | Source                                                                                                                                                                                                                    | Read       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| The stem never repeats the folder      | [Gerrand, Package names](https://go.dev/blog/package-names): "Since client code uses the package name as a prefix when referring to the package contents, the names for those contents need not repeat the package name." | 2026-10-24 |
| Drop the prefix and retarget on a move | House choice: a file moved into a subfolder that keeps its old prefix says its folder twice, and a citation left on the old path resolves nowhere                                                                         | 2026-10-24 |
| The stem runs to the first dot         | House choice: reading the stem past a suffix lets `checkout/checkout.test.ts` pass a check that `checkout/checkout.md` fails, though both repeat their folder                                                             | 2026-10-24 |

## Split before the file lands

| Bullet                                 | Source                                                                                                                                                                                                                                                                                                                     | Read       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Split on a second role, before landing | [Martin, The Single Responsibility Principle](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html): "Separate those things that change for different reasons." Splitting before the file lands is a House choice: the split costs a handful of paths then and 98 later, as the body records | 2026-10-24 |
| Ten files is a prompt, not a gate      | House choice: no source gives a reliable ceiling, and a count fails a large folder of one role that reads fine flat while passing a small one mixing two                                                                                                                                                                   | 2026-10-24 |
| A new role gets a named folder         | House choice: a role whose first file lands beside its nearest neighbor leaves the folder holding two roles, and the next file copies the first                                                                                                                                                                            | 2026-10-24 |

## Place a file with its consumer

| Bullet                         | Source                                                                                                                                                                                                                                             | Read       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Colocate with the one consumer | [Dodds, Colocation](https://kentcdodds.com/blog/colocation): "Place code as close to where it's relevant as possible"                                                                                                                              | 2026-10-24 |
| Promote on the second consumer | [Wieruch, React Folder Structure](https://www.robinwieruch.de/react-folder-structure/): "if exactly one feature uses a util, it lives inside that feature", and "once two or more features need it, it moves up to the shared layer"               | 2026-10-24 |
| Imports flow one way           | [bulletproof-react, Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md): "the code should flow in one direction, from shared parts of the code to the application (shared -> features -> app)" | 2026-10-24 |

## State the reason on every new path

| Bullet                                | Source                                                                                                                                                                | Read       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| A one-clause reason per new path      | House choice: a worker copies the path a plan gives it, so a path with no stated reason lands beside its nearest neighbor and the plan's placement call is never made | 2026-10-24 |
| Name a new folder where it is created | House choice: a folder the plan leaves implied is inferred by the worker, who drops the file in the nearest existing folder instead                                   | 2026-10-24 |

## Read the reference for the category

| Bullet                     | Source                                                                                                                                                                        | Read       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Interface source reference | House choice: an interface file placed without `frontend.md` lands in the shared `components/` or `lib/` folder whatever its consumer, the flat growth that reference records | 2026-10-24 |
| Test file reference        | House choice: a test helper placed without `tests.md` lands beside the specs it serves, so the end to end folder stops holding one role                                       | 2026-10-24 |
