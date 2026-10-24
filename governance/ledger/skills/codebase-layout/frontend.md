---
title: Frontend layout reference ledger
description: Sources for claude/skills/codebase-layout/references/frontend.md, one row per bullet
---

# Frontend layout reference ledger

The field is interface source organization. bulletproof-react carries feature folders and the import direction, Robin Wieruch carries the levels and the promotion rule, and the Next.js docs carry routing. Each row cites the bullet's own inline link where the reference carries one.

The worked failure reports what one project's folders did, so its rows are house choices naming the failure the incident shows rather than outside citations.

## Feature folders against shared UI

| Bullet                                  | Source                                                                                                                                                                                                                                                  | Read       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| One feature's code under its folder     | [bulletproof-react, Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md): "organize most of the code within the features folder", and "Only include the ones that are necessary for the feature."    | 2026-10-24 |
| Shared `components/` for two features   | [bulletproof-react, Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md): `components` holds "shared components used across the entire application"                                                  | 2026-10-24 |
| One feature's component is feature code | [Wieruch, React Folder Structure](https://www.robinwieruch.de/react-folder-structure/): feature components "are often only used once in a React project", while generic UI components "are used by more than one component"                             | 2026-10-24 |
| No feature imports another              | [bulletproof-react, Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md): "It might not be a good idea to import across the features. Instead, compose different features at the application level." | 2026-10-24 |
| Enforce the flow with an import lint    | [bulletproof-react, Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md): "To forbid cross-feature imports, you can use ESLint", through `import/no-restricted-paths`                                | 2026-10-24 |

## Grow in levels

| Bullet                          | Source                                                                                                                                                                                                                                                    | Read       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Start flat                      | [React, File Structure](https://legacy.reactjs.org/docs/faq-structure.html): "If you feel completely stuck, start by keeping all files in a single folder. Eventually it will grow large enough that you will want to separate some files from the rest." | 2026-10-24 |
| The next level on a named event | [Wieruch, React Folder Structure](https://www.robinwieruch.de/react-folder-structure/): "The day the customer feature needs it too, it moves up to the top-level hooks/ folder."                                                                          | 2026-10-24 |
| One level per change            | House choice: a plan that jumps from flat to a full feature tree rewrites every import in the project in one diff no review can follow                                                                                                                    | 2026-10-24 |

## Routes

| Bullet                                    | Source                                                                                                                                                                                                                                      | Read       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| The router's own conventions first        | [Next.js, Project structure](https://nextjs.org/docs/app/getting-started/project-structure): the page gives "an overview of all the folder and file conventions in Next.js, and recommendations for organizing your project"                | 2026-10-24 |
| An unopinionated framework leaves it open | [Next.js, Project structure](https://nextjs.org/docs/app/getting-started/project-structure): "Next.js is unopinionated about how you organize and colocate your project files."                                                             | 2026-10-24 |
| One strategy, kept consistent             | [Next.js, Project structure](https://nextjs.org/docs/app/getting-started/project-structure): "choose a strategy that works for you and your team and be consistent across the project"                                                      | 2026-10-24 |
| A route's component in a private folder   | [Next.js, Project structure](https://nextjs.org/docs/app/getting-started/project-structure): private folders "colocate non-routable files", as `app/blog/_components/Post.tsx` is marked "Not routable" and a "safe place for UI utilities" | 2026-10-24 |
| `components` and `lib` are placeholders   | [Next.js, Project structure](https://nextjs.org/docs/app/getting-started/project-structure): "we're using components and lib folders as generalized placeholders, their naming has no special framework significance"                       | 2026-10-24 |

## Hooks and helpers

| Bullet                                  | Source                                                                                                                                                                                             | Read       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| One feature's hook inside it            | [Wieruch, React Folder Structure](https://www.robinwieruch.de/react-folder-structure/): "A hook that only the project feature uses lives inside features/project/hooks/ ."                         | 2026-10-24 |
| Promote on the second feature           | [Wieruch, React Folder Structure](https://www.robinwieruch.de/react-folder-structure/): "once two or more features need it, it moves up to the shared layer"                                       | 2026-10-24 |
| Split a shared `lib/` holding two roles | [Martin, The Single Responsibility Principle](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html): "Separate those things that change for different reasons."      | 2026-10-24 |
| A helper named for what it does         | [Gerrand, Package names](https://go.dev/blog/package-names): "Avoid meaningless package names. Packages named util , common , or misc provide clients with no sense of what the package contains." | 2026-10-24 |

## Fixtures and sample data

| Bullet                            | Source                                                                                                                                                      | Read       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Fixtures beside their feature     | [Dodds, Colocation](https://kentcdodds.com/blog/colocation): "Things that change together should be located as close as reasonable."                        | 2026-10-24 |
| Promote a fixture on two features | House choice: a fixture moved to shared code for one feature's tests drifts from that feature, and the next change to it lands far from the tests it breaks | 2026-10-24 |

## A worked failure

| Bullet                                        | Source                                                                                                                                                               | Read       |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| The rules said split, and nobody applied them | House choice: a rule loaded beside a plan that names every file as a sibling of the last loses to the plan, so placement has to be decided where the path is written | 2026-10-24 |
| The split touched 98 files                    | House choice: a split put off until a folder overflows touches every import of every file in it, and a folder left without a placement rule grows flat again         | 2026-10-24 |
| A named subfolder at the twelfth file         | House choice: the cost of placement grows with the folder, so the cheapest split is the one a plan names when the second role's first file arrives                   | 2026-10-24 |
