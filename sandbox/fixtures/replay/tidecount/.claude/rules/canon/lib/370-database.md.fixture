---
description: Enforce persistence boundaries for migrations, query construction, transactions, and rollback
paths:
  - '**/*.py'
  - '**/*.ts'
  - '**/*.js'
  - '**/*.sql'
---

# Persistence standards

## Schema changes

- Express every schema change as a migration file committed to version control.
- Ship a tested rollback path with every migration that changes a schema.
- Never alter a deployed schema outside a migration.
- Never edit a migration that has run in a shared environment. Add a new one.
- Separate a destructive migration from the deploy that stops reading the dropped column.

## Query construction

- Pass every runtime value as a bound parameter.
- Never interpolate, concatenate, or format a value into a statement string.
- Name the columns a read needs. Do not select every column by wildcard.

## Transactions

- Give each transaction one owner that opens it, commits it, and rolls it back.
- Never open a transaction inside a function that was handed one.
- Keep network calls, queue publishes, and filesystem writes outside an open transaction.

## Access patterns

- Load related rows in the query that fetches their parents. Do not resolve a relation lazily inside an iteration.
- Scope a connection or session to the request that opened it and release it on exit.
