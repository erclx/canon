---
title: Python rule ledger
description: Sources for governance/rules/lang/python.md, one row per bullet
---

# Python rule ledger

The field is Python programming, and the authority is the Python documentation at docs.python.org with the PEPs at peps.python.org. The library pages read are the Python 3.15 documentation.

## Type hints

| Bullet                                  | Source                                                                                                                                                                                                          | Read                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Annotate public functions               | House choice: a gradual type checker treats an unannotated function as dynamically typed and leaves its body unchecked, so a public function with no hints hides its callers' mistakes                          | 2026-10-18              |
| `X \| None` and built-in generics       | [typing](https://docs.python.org/3/library/typing.html): the `int \| str` shorthand "is recommended", `Optional[X]` "is equivalent to `X \| None`", and `typing.List` is a "Deprecated alias to list" since 3.9 | 2026-10-18, Python 3.15 |
| No `from __future__ import annotations` | [`__future__`](https://docs.python.org/3/library/__future__.html): "This feature will eventually be deprecated and removed. See PEP 649 and PEP 749."                                                           | 2026-10-18, Python 3.15 |
| `Protocol` over an ABC                  | [PEP 544](https://peps.python.org/pep-0544/): with an ABC "a class has to be explicitly marked to support them", and protocols provide "structural subtyping (static duck typing)"                              | 2026-10-18              |
| `object` over `Any`                     | [typing](https://docs.python.org/3/library/typing.html#the-any-type): "Use object to indicate that a value could be any type in a typesafe manner. Use Any to indicate that a value is dynamically typed."      | 2026-10-18, Python 3.15 |

## Errors

| Bullet                   | Source                                                                                                                                                                                     | Read       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Specific exception class | [PEP 8](https://peps.python.org/pep-0008/#programming-recommendations): "Design exception hierarchies based on the distinctions that code catching the exceptions is likely to need"       | 2026-10-18 |
| Narrowest catch          | [PEP 8](https://peps.python.org/pep-0008/#programming-recommendations): "When catching exceptions, mention specific exceptions whenever possible instead of using a bare `except:` clause" | 2026-10-18 |
| `raise ... from err`     | [PEP 8](https://peps.python.org/pep-0008/#programming-recommendations): "`raise X from Y` should be used to indicate explicit replacement without losing the original traceback"           | 2026-10-18 |

## Data shapes

| Bullet                    | Source                                                                                                                                                                                                                  | Read                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Frozen, slotted dataclass | [dataclasses](https://docs.python.org/3/library/dataclasses.html): with `frozen`, "assigning to fields will generate an exception", and `slots` generates `__slots__`, added in 3.10                                    | 2026-10-18, Python 3.15 |
| `Enum` for a closed set   | [enum](https://docs.python.org/3/library/enum.html): an enumeration "is a set of symbolic names (members) bound to unique values", and `StrEnum` members "are also strings", added in 3.11                              | 2026-10-18, Python 3.15 |
| `pathlib` over `os.path`  | [pathlib](https://docs.python.org/3/library/pathlib.html): "`Path` is most likely what you need", and its normalization is "more opinionated and consistent than `os.path`", keeping `..` segments "for greater safety" | 2026-10-18, Python 3.15 |

## Imports and modules

| Bullet                | Source                                                                                                                                                                                                                                | Read                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Absolute imports      | [PEP 8](https://peps.python.org/pep-0008/#imports): "Absolute imports are recommended, as they are usually more readable and tend to be better behaved"                                                                               | 2026-10-18              |
| No shortening aliases | House choice: an internal name aliased at import no longer matches its definition, so a search for the name misses every call site behind the alias                                                                                   | 2026-10-18              |
| `__main__` guard      | [`__main__`](https://docs.python.org/3/library/__main__.html): imported "to unit test it, the script code would unintentionally execute as well", and "Most often, a function named main encapsulates the program's primary behavior" | 2026-10-18, Python 3.15 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Contradicted by the docs

- Reworded the pydantic-only `__future__` caveat to a plain ban, since the docs say the feature "will eventually be deprecated and removed".
- Reworded the ban on parent-relative imports to a preference for absolute ones. PEP 8 calls explicit relative imports "an acceptable alternative to absolute imports", so a ban overstated it.
- Cut `typing.cast` as the alternative to `Any`, since the docs say it "returns the value unchanged" and checks nothing. The bullet now names `object`.

### A convention Claude follows unprompted

PEP 8's naming conventions set all four casing bullets, and Claude writes them without the rule.

- Cut "`snake_case` for modules, functions, variables, and methods".
- Cut "`PascalCase` for classes, type aliases, `TypeVar`, and `ParamSpec`".
- Cut "`UPPER_SNAKE_CASE` for module-level constants and environment variables", which PEP 8 states as "written in all capital letters with underscores separating words".
- Cut "`_leading_underscore` for module-private names, `__dunder__` for the protocol".

### Merged or reworded

- Merged the `X | None` bullet and the built-in generics bullet, since both replace a `typing` spelling with the native one.
- Merged "raise specific built-in exceptions" and "define a project-rooted exception hierarchy" into one bullet naming both kinds a raise may take.
- Narrowed "annotate all public functions, methods, and class attributes" to functions and methods, and gave it the unchecked-body reason.
- Gave the `__main__` guard the docs' own shape, a `main` function the guard calls.
