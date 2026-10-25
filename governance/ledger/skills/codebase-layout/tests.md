---
title: Test layout reference ledger
description: Sources for claude/skills/codebase-layout/references/tests.md, one row per bullet
---

# Test layout reference ledger

The field is test file organization. Kent C. Dodds carries colocating a test with its module, and Playwright's fixtures and page object docs carry the split between specs and support. The reference's worked failure is prose rather than bullets, so it takes no table.

## Unit and component tests

| Bullet                                | Source                                                                                                                                                                                                                                      | Read       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| A test beside its module              | [Dodds, Colocation](https://kentcdodds.com/blog/colocation): "we should co-locate our tests files with the file or group of files they are testing"                                                                                         | 2026-10-24 |
| The test moves with the module        | [Dodds, Colocation](https://kentcdodds.com/blog/colocation): with a mirrored tree, "We'd move or delete a src/ file without updating the corresponding" file beside it, and "All the pitfalls described above apply here as well" for tests | 2026-10-24 |
| A one-file factory stays in that file | [Wieruch, React Folder Structure](https://www.robinwieruch.de/react-folder-structure/): "if exactly one feature uses a util, it lives inside that feature", and "once two or more features need it, it moves up to the shared layer"        | 2026-10-24 |

## End to end tests

| Bullet                                  | Source                                                                                                                                                                                                                                               | Read       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Only specs in the runner's folder       | House choice: support code among the specs gives a new spec no single place to find its setup, and the next helper lands beside the others                                                                                                           | 2026-10-24 |
| One merged fixtures module              | [Playwright, Fixtures](https://playwright.dev/docs/test-fixtures): an extended test "can be used in multiple test files, and each of them will get the fixtures", and `mergeTests` combines "test fixtures from multiple files or modules"           | 2026-10-24 |
| Each page object its own module         | [Playwright, Fixtures](https://playwright.dev/docs/test-fixtures) imports each page object from its own module, as `TodoPage` from `./todo-page`, and [page object models](https://playwright.dev/docs/pom) capture "element selectors in one place" | 2026-10-24 |
| Support in its own folder, named by use | House choice: a single `helpers` file every spec imports grows into a bucket naming no role, the fault the body's naming rule forbids for any folder                                                                                                 | 2026-10-24 |
| Group specs by journey once they mix    | House choice: specs for two journeys in one folder hold two roles, so a reader finds a journey's specs only by opening each file                                                                                                                     | 2026-10-24 |
