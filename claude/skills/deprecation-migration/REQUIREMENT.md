---
name: deprecation-migration
description: Why a session retiring code needs stated rules for deciding to deprecate, migrating callers, and proving none remain before removal, and where that discipline stops short of additive interface change, file placement, and schema migrations
---

# Deprecation and migration requirement

## Gap

Nothing tells a session how to retire a function, a flag, a file, or a command. The persistence rule covers only the destructive half of a schema change, and `api-design` stops at adding a new name beside an old one, without saying how a session proves the old one unused or who moves the callers.

The result is an expand step with no contract step behind it, a fallback kept "until a release retires it" with no removal condition, and a deprecation announced while every consumer is left to migrate alone.

## Must

- Decide to deprecate by four questions, being what keeping it costs, who calls it, what replaces it, and who migrates the callers
- Separate advisory from compulsory deprecation, allowing compulsory only once a replacement has shipped and a removal date sits where a caller looks
- Make the owner of a surface migrate its callers rather than announce and wait
- Prove zero consumers across imports, string references, configuration, documentation, and outside copies before removal, naming any kind the search could not reach
- Run expand, migrate, and contract as three changes, then close with excuses, red flags, and a checklist

## Must not

- Name a toolkit command, a toolkit-local path, or a project, since the body ships to targets
- State a numeric deprecation window
- Restate additive change or the One-Version Rule, or the persistence rule's schema bullets
- Report a removal as clean while a caller kind went unsearched

## Out of scope

- Database schema migrations and their down paths, which the project's persistence rule owns
- Release versioning and changelog format, which a release process owns
- Moving or renaming a file with no caller change, which `codebase-layout` owns
- Adding a field, flag, or parameter beside an old one, which `api-design` owns
