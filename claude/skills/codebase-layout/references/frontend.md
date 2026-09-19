---
title: Frontend layout
description: Where interface source goes, being feature folders against shared UI, routes and their private folders, hooks and helpers split by consumer, fixtures by feature, and the promotion rule, with one worked failure
---

# Frontend layout

Read this before placing a new component, hook, helper, route, or fixture in an interface project. The body's rules hold here unchanged, and this file says how they land on the folders an interface project grows.

## Feature folders against shared UI

- Put code that serves one feature under that feature's folder, holding only the subfolders it needs: its components, its hooks, its data access, its types ([bulletproof-react](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)).
- Keep the shared `components/` folder for pieces two or more features render, such as a button, a dialog, or a layout shell. A component only one feature renders is feature code, even when it looks generic.
- Never import one feature from another. Lift the piece both need to shared code, or compose the two features at the app or route level ([bulletproof-react](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)).
- Enforce the flow from shared toward features toward the app where the project already lints imports. An import-path restriction turns the direction into a check rather than a habit.

## Grow in levels

- Start flat. A small project with one screen needs no feature folders, and adding them early is structure nobody reads.
- Move to the next level on a named event rather than a count: a second feature, a second role in `components/`, a helper only one feature uses ([Robin Wieruch](https://www.robinwieruch.de/react-folder-structure/)).
- Take one level per change. A plan that jumps from flat to a full feature tree rewrites every import in the project.

## Routes

- Follow the router's own conventions where the framework ships file-based routing, and treat everything outside them as project strategy.
- A framework calling itself unopinionated about organization leaves the strategy to the project. Pick one of keeping code outside the routes folder, top-level folders inside it, or splitting by feature or route, and "be consistent across the project" ([Next.js project structure](https://nextjs.org/docs/app/getting-started/project-structure)).
- Colocate a component only one route renders beside that route, in a folder the router excludes from routing, such as a private `_components` folder in a router that supports one.
- Treat `components` and `lib` as placeholder names with no framework meaning. Their contents still follow the body's rules.

## Hooks and helpers

- Put a hook or helper one feature uses inside that feature. Promote it to a shared `hooks/` or `lib/` folder when a second feature needs it, and move it in the change that adds the second consumer ([Robin Wieruch](https://www.robinwieruch.de/react-folder-structure/)).
- Split a shared `lib/` by what each file serves once it holds two roles, such as data access beside formatting beside browser APIs. A flat `lib/` is the second folder to overflow after `components/`.
- Name a helper file for what it does rather than `utils` or `helpers`, so the folder listing reads as an index.

## Fixtures and sample data

- Keep fixtures and sample data beside the feature they describe, and name the file for that feature.
- Promote a fixture to a shared folder only when two features' tests build from it.

## A worked failure

An interface project's `components/` folder held 11 files when its first plan landed and 46 six days later, with its `lib/` at 36, all flat. Every plan in between named each new file as a sibling of the last, since the folder it was measured against was flat. The installed rules said to split by role and to keep domain logic in feature folders, and neither was applied. The split, when it came, touched 98 files, and the project's end to end folder has since grown flat again, four specs beside five helpers. Placing the twelfth component in a named subfolder would have cost that plan one folder.
