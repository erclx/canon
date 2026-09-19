---
title: Test layout
description: Where test files live once their layer is chosen, being unit tests beside their module and an end to end folder split into specs, a fixtures module, page objects, and support, with one worked failure
---

# Test layout

Read this before placing a new test file or a file a test imports. Which layer the test belongs at is settled first, by `test-craft`. This file starts from that answer and says where the file goes.

## Unit and component tests

- Put a unit or component test beside the module it tests, named after it, so a reader opening the module finds its test in the same listing.
- Move the test with the module. A test left behind in a folder its module has left is the first sign the folder no longer holds one role.
- Keep a factory or builder one test file uses inside that file. Move it beside the tests that share it once a second file needs it, and name it for what it builds.

## End to end tests

A browser suite starts as a folder of specs, and every helper written after the first lands beside them unless something says otherwise. Split the folder by role before the first support file lands.

- Keep specs in the folder the runner reads, and nothing there but specs once support code exists.
- Put fixtures in a dedicated module that extends the runner's base test, and merge several into one fixtures module the specs import ([Playwright fixtures](https://playwright.dev/docs/test-fixtures)). A spec importing its setup from one place is how a new spec finds what exists.
- Give each page object its own module, named for the page or region it drives ([Playwright fixtures](https://playwright.dev/docs/test-fixtures)).
- Put helpers, stubs, and seed data in a support folder beside the specs rather than among them. Name each file for what it serves, never a single `helpers` file every spec imports.
- Group specs by journey once they mix, such as checkout specs in one folder and account specs in another. A folder of a handful of specs covering one journey stays flat.

## A worked failure

An interface project's end to end folder held four specs beside five helper files, all flat, after an earlier refactor had split its source folders by role. The project's plans named every new file as a literal flat path, so each helper landed as a sibling of the specs it served. A new spec then had no single place to find its setup, and the next helper went beside the others. One plan naming a support folder when the first helper arrived would have kept the specs as the folder's only role.
