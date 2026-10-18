---
title: Pydantic rule ledger
description: Sources for governance/rules/lib/pydantic.md, one row per bullet
---

# Pydantic rule ledger

The field is Python data validation, and the authority is the Pydantic documentation at pydantic.dev, which moved from docs.pydantic.dev. Every page read is the Pydantic 2 docs, so a version-bound bullet opens with "On Pydantic 2" and a Pydantic 1 target is never told to call an API it lacks.

## Models

| Bullet                       | Source                                                                                                                                                                                       | Read                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `BaseModel` at boundaries    | House choice: a standard library `dataclass` checks no type at runtime, so malformed input passes the boundary unvalidated                                                                   | 2026-10-18, Pydantic 2 |
| `model_config`, not `Config` | [Migration guide](https://pydantic.dev/docs/validation/latest/get-started/migration/): "to specify config on a model, you should set a class attribute called `model_config`"                | 2026-10-18, Pydantic 2 |
| `extra="forbid"` on input    | [Models](https://pydantic.dev/docs/validation/latest/concepts/models/): "`'forbid'`: Providing extra data is not permitted", and "`'ignore'`: Providing extra data is ignored (the default)" | 2026-10-18, Pydantic 2 |
| Constraints in `Field(...)`  | [Fields](https://pydantic.dev/docs/validation/latest/concepts/fields/): "The Field() function can also be used to add constraints to specific types"                                         | 2026-10-18, Pydantic 2 |

## Validation

| Bullet                                     | Source                                                                                                                                                                                     | Read                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| `model_validate` and `model_validate_json` | [Models](https://pydantic.dev/docs/validation/latest/concepts/models/): for a JSON payload, `model_validate_json()` "is generally considered faster" than parsing it to a dictionary first | 2026-10-18, Pydantic 2 |
| v2 validator decorators                    | [Migration guide](https://pydantic.dev/docs/validation/latest/get-started/migration/): "`@validator` has been deprecated", and so has `@root_validator`, each replaced by its v2 decorator | 2026-10-18, Pydantic 2 |
| Cross-field checks after                   | [Validators](https://pydantic.dev/docs/validation/latest/concepts/validators/): after model validators "run after the whole model has been validated"                                      | 2026-10-18, Pydantic 2 |

## Types

| Bullet                       | Source                                                                                                                                                                                           | Read                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| `SecretStr` for credentials  | [Pydantic Types](https://pydantic.dev/docs/validation/latest/api/pydantic/types/): "A string used for storing sensitive information that you do not want to be visible in logging or tracebacks" | 2026-10-18, Pydantic 2 |
| Constrained types over regex | [Pydantic Types](https://pydantic.dev/docs/validation/latest/api/pydantic/types/): `PositiveInt` is "An integer that must be greater than zero"                                                  | 2026-10-18, Pydantic 2 |
| `Annotated` for reuse        | [Fields](https://pydantic.dev/docs/validation/latest/concepts/fields/): Pydantic "supports the Annotated typing construct", and "Types can be made reusable"                                     | 2026-10-18, Pydantic 2 |
| No `Any` fields              | [Standard Library Types](https://pydantic.dev/docs/validation/latest/api/standard_library_types/): `Any` "Allows any value, including `None`"                                                    | 2026-10-18, Pydantic 2 |

## Settings

| Bullet                   | Source                                                                                                                                                                                                                    | Read                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| One `BaseSettings` model | [Settings Management](https://pydantic.dev/docs/validation/latest/concepts/pydantic_settings/): the initializer "will attempt to determine the values of any fields not passed as keyword arguments" from the environment | 2026-10-18, Pydantic 2 |

## Serialization

| Bullet                    | Source                                                                                                                                                                                                                                                                                                               | Read                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `model_dump(mode="json")` | [Serialization](https://pydantic.dev/docs/validation/latest/concepts/serialization/): "The `mode` argument can be set to `'json'` to ensure JSON-compatible types are used", and the [migration guide](https://pydantic.dev/docs/validation/latest/get-started/migration/) says "The `.json()` method is deprecated" | 2026-10-18, Pydantic 2 |
| `by_alias=True` outward   | [Fields](https://pydantic.dev/docs/validation/latest/concepts/fields/): "the by_alias keyword argument defaults to False, and must be specified explicitly"                                                                                                                                                          | 2026-10-18, Pydantic 2 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Merged or reworded

- Merged "use `@field_validator` over the legacy `@validator`" with the `@root_validator` swap, which the old rule never named.
- Merged "use `model.model_dump_json()` over `json.dumps(model.dict())`" into the serialization bullet beside `model_dump(mode="json")`.
- Merged "use `Model.model_validate_json(s)` over `json.loads`" into the `model_validate` bullet. `Model(**data)` validates too, so the old contrast named no bug.
- Merged "use `pydantic_settings.BaseSettings` for env-driven configuration" into the one-model bullet.
- Narrowed "use `AnyUrl`, `EmailStr`, `SecretStr`, and `PositiveInt` over hand-rolled regex" into a `SecretStr` bullet for the log leak and a constrained-type bullet.
- Prefixed every legacy-API swap with "On Pydantic 2", since the rule loads on every Python file and a Pydantic 1 target lacks the v2 names.
- Reworded "use `Field(...)` over docstring conventions" to name the enforcement a docstring lacks.
