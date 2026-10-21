---
description: Build UI against the tracked design references under canon/design, and show each reference beside its build in the pull request
paths:
  - 'canon/design/**'
  - '**/*.tsx'
  - '**/*.jsx'
  - '**/*.vue'
  - '**/*.svelte'
  - '**/*.astro'
  - '**/*.html'
  - '**/*.css'
  - '**/*.scss'
---

# Design reference standards

## Where the design lives

- Build UI against `canon/design/`, never against the canvas directly.
- Load the `canon:design-record` skill before adding, redrawing, or removing a reference under `canon/design/`, and report it rather than proceeding silently when it does not resolve.
- Land a picked or changed canvas design in `canon/design/` through the project's design sync, as its own pull request, before any feature builds against it.
- Never copy, edit, or delete a reference file under `canon/design/` by hand.
- Add a new surface's row to the index in `canon/design/` before running the sync, and remove it only in the change that removes the surface.

## Building against a reference

- Open each reference image and its frame HTML, light and dark, before changing the surface they show.
- Match the reference closely or identically, taking sizes, spacing, and colors from the frame HTML.

## Showing the comparison

- Put each changed surface's reference image beside its built capture, light and dark, in the pull request description.
- Name each place the build departs from its reference, with its reason, in the pull request description.
- Report an unexplained departure from a reference as a review finding.

## Naming

- Give each app part one plain kebab-case folder under `canon/design/`, and name each file `<name>-dark` or `<name>-light`.
