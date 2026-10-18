---
description: Enforce pydantic v2 patterns for validation and serialization
paths:
  - '**/*.py'
---

# Pydantic standards

## Models

- Use `pydantic.BaseModel` over a standard library `dataclass` at I/O and API boundaries, since a `dataclass` validates nothing.
- On Pydantic 2, configure a model with `model_config = ConfigDict(...)`, never the deprecated nested `Config` class.
- Set `extra="forbid"` on a model receiving external input, since the default ignores an unknown key silently.
- Declare a constraint with `Field(...)`, such as `gt=0`, so validation enforces it rather than a docstring.

## Validation

- Validate an untrusted dict with `Model.model_validate(data)`, and a JSON string with `Model.model_validate_json(s)` rather than `json.loads` first.
- On Pydantic 2, write `@field_validator` and `@model_validator`, never the deprecated `@validator` or `@root_validator`.
- Check a cross-field invariant in `@model_validator(mode="after")`.

## Types

- Use `SecretStr` for a credential, so its value stays out of logs and tracebacks.
- Use a constrained type such as `PositiveInt` or `EmailStr` over a hand-rolled regex.
- Share a constrained type as `Annotated[T, Field(...)]`.
- Never type a field `Any`, which allows any value including `None`. Use `JsonValue` or a union of concrete types.

## Settings

- Load environment through one `pydantic_settings.BaseSettings` model. Never read `os.environ` directly elsewhere.

## Serialization

- On Pydantic 2, serialize with `model_dump(mode="json")` or `model_dump_json()`, never the deprecated `.dict()` or `.json()`.
- Pass `by_alias=True` when serializing to an external schema, since a dump ignores aliases by default.
