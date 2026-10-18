---
title: Persistence rule ledger
description: Sources for governance/rules/lib/database.md, one row per bullet
---

# Persistence rule ledger

The field is database engineering, plus application security for query construction. The authorities are the migration and ORM documentation of Rails, Prisma, Django, and SQLAlchemy, the PostgreSQL manual, Martin Fowler's article on evolutionary database design, and the OWASP Cheat Sheet Series. Spike S1 of the rule-standard groundwork drafted this ledger, and its three unopened leads were read for it.

## Schema changes

| Bullet                           | Source                                                                                                                                                                                                                                                                                                                                                                                    | Read       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Every change is a migration      | [Evolutionary Database Design](https://martinfowler.com/articles/evodb.html): every change is "a database migration script which is version controlled together with application code changes"                                                                                                                                                                                            | 2026-10-18 |
| A way back, down or forward      | [Rails migrations](https://guides.rubyonrails.org/active_record_migrations.html): "you can raise `ActiveRecord::IrreversibleMigration` in your `down` block", and [Prisma down migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/generating-down-migrations) undoes an applied one with "you will instead need to revert your `schema.prisma` file" and a new migration | 2026-10-18 |
| No change outside a migration    | [Evolutionary Database Design](https://martinfowler.com/articles/evodb.html): the authors never "run ad hoc DDL or DML", and "all changes are made by migrations"                                                                                                                                                                                                                         | 2026-10-18 |
| Never edit a run migration       | [Rails migrations](https://guides.rubyonrails.org/active_record_migrations.html): "editing existing migrations that have been already committed to source control is not a good idea"                                                                                                                                                                                                     | 2026-10-18 |
| Drop after reads and writes stop | [Expand and contract](https://www.prisma.io/dataguide/types/relational/expand-and-contract-pattern): "Once all clients have been updated to stop writing to the original schema, you can safely delete the original data structure"                                                                                                                                                       | 2026-10-18 |

## Query construction

| Bullet                    | Source                                                                                                                                                                                                                                                | Read       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Bind every runtime value  | [SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html): developers "should be told to use prepared statements with variable binding (aka parameterized queries)"                        | 2026-10-18 |
| Never interpolate a value | [SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html): building the string by hand ranks last, as "STRONGLY DISCOURAGED: Escaping All User Supplied Input"                             | 2026-10-18 |
| Allow-list identifiers    | [SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html): for "table names, column names, or sort order indicators", "input validation or query redesign is the most appropriate defense" | 2026-10-18 |

## Transactions

| Bullet                               | Source                                                                                                                                                                                                                                                                                                                                                       | Read       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| One owner per transaction            | [SQLAlchemy session basics](https://docs.sqlalchemy.org/en/20/orm/session_basics.html): "Keep the lifecycle of the session (and usually the transaction) separate and external"                                                                                                                                                                              | 2026-10-18 |
| Savepoint, never commit a handed one | [Django transactions](https://docs.djangoproject.com/en/5.2/topics/db/transactions/): Django "creates a savepoint when entering an inner `atomic` block" and commits "when exiting the outermost block", and [PostgreSQL SAVEPOINT](https://www.postgresql.org/docs/current/sql-savepoint.html) "establishes a new savepoint within the current transaction" | 2026-10-18 |
| Side effects after commit            | [Django transactions](https://docs.djangoproject.com/en/5.2/topics/db/transactions/): `on_commit()` callbacks run "after the open transaction is successfully committed", for "a background task, an email notification, or a cache invalidation"                                                                                                            | 2026-10-18 |

## Access patterns

| Bullet                      | Source                                                                                                                                                                                                                                                                                                                      | Read       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Load relations with parents | [Django optimization](https://docs.djangoproject.com/en/5.2/topics/db/optimization/): "Retrieve everything at once if you know you will need it", naming `select_related()` and `prefetch_related()`, and [Rails querying](https://guides.rubyonrails.org/active_record_querying.html) solves N + 1 queries with `includes` | 2026-10-18 |
| Session per request         | [SQLAlchemy session basics](https://docs.sqlalchemy.org/en/20/orm/session_basics.html): "create a Session at the start of a web request" and "close the session at the end of web request"                                                                                                                                  | 2026-10-18 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Contradicted by the docs

- Cut "name the columns a read needs, never select every column by wildcard". The [Django optimization](https://docs.djangoproject.com/en/5.2/topics/db/optimization/) page says "Don't be too aggressive in deferring fields without profiling", and no page read backs the ban.
- Narrowed "never open a transaction inside a function that was handed one". Django designs a nested `atomic` as a savepoint, so the bullet now bans committing the caller's transaction.
- Reworded "ship a tested rollback path with every migration". Prisma has no down step and undoes a migration with a new one, which the old wording read as missing.

### Merged or reworded

- Reworded "separate a destructive migration from the deploy that stops reading the dropped column" to the order expand and contract states, removal after reads and writes stop.

### Gaps filled

- Added the allow-list bullet. OWASP names identifiers as the part of a query no bind reaches, the case a model gets wrong after it binds every value.

### Leads read

- Fowler's article backs the migration bullets but says nothing on editing an applied migration, so Rails carries that row.
- The PostgreSQL `SAVEPOINT` page backs the savepoint wording beside Django's.
- The Rails querying guide backs eager loading through `includes`.
