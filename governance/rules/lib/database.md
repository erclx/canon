---
description: Enforce persistence boundaries for migrations, query construction, transactions, and rollback
paths:
  - '**/*.py'
  - '**/*.ts'
  - '**/*.js'
  - '**/*.go'
  - '**/*.php'
  - '**/*.sql'
---

# Persistence standards

## Schema changes

- Express every schema change as a migration file committed to version control.
- Ship a way back with every schema migration, as a down step or a forward migration that reverses it.
- Never alter a deployed schema outside a migration.
- Never edit a migration that has run in a shared environment. Add a new one.
- Drop a column or table only after a deploy that stops reading and writing it.

## Query construction

- Pass every runtime value as a bound parameter.
- Never interpolate, concatenate, or format a value into a statement string.
- Map a table name, column, or sort direction through an allow-list, since none of them can be bound.

## Transactions

- Give each transaction one owner that opens it, commits it, and rolls it back.
- Never commit a transaction a function was handed. Take a savepoint, such as a nested `atomic`, for a partial rollback.
- Keep network calls, queue publishes, and filesystem writes outside an open transaction, running them after commit.

## Access patterns

- Load related rows in the query that fetches their parents. Do not resolve a relation lazily inside an iteration.
- Scope a connection or session to the request that opened it and release it on exit.
