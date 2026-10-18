---
title: FastAPI rule ledger
description: Sources for governance/rules/framework/fastapi.md, one row per bullet
---

# FastAPI rule ledger

The field is back-end Python web engineering, and the authority is the FastAPI documentation at fastapi.tiangolo.com. None of the pages read names a FastAPI major, so the rows record the read date alone.

## Routers

| Bullet                      | Source                                                                                                                                                                                              | Read       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| One `APIRouter` per feature | [Bigger Applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/): "You can think of APIRouter as a mini FastAPI class", and "With app.include_router() we can add each APIRouter"  | 2026-10-18 |
| Router-level dependencies   | [Bigger Applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/): router `dependencies` "can be used, for example, to require authentication for a whole group of path operations" | 2026-10-18 |

## Path operations

| Bullet                        | Source                                                                                                                                                                                                                                    | Read       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `async def` only when awaited | [Concurrency and async / await](https://fastapi.tiangolo.com/async/): a plain `def` "is run in an external threadpool that is then awaited", and "use async def unless your path operation functions use code that performs blocking I/O" | 2026-10-18 |
| Response model omits secrets  | [Response Model](https://fastapi.tiangolo.com/tutorial/response-model/): FastAPI "will limit and filter the output data to what is defined in the return type"                                                                            | 2026-10-18 |
| Body as a Pydantic model      | [Request Body](https://fastapi.tiangolo.com/tutorial/body/): "To declare a request body, you use Pydantic models", which validate it and return "a nice and clear error" when it is invalid                                               | 2026-10-18 |

## Dependencies

| Bullet                          | Source                                                                                                                                                                                            | Read       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `Annotated` and type aliases    | [Dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/): "Prefer to use the Annotated version if possible", and the value can be stored "in a variable and use it in multiple places" | 2026-10-18 |
| Session per request via `yield` | [Dependencies with yield](https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-with-yield/): "you could use this to create a database session and close it after finishing"            | 2026-10-18 |
| Overrides in tests              | [Testing Dependencies with Overrides](https://fastapi.tiangolo.com/advanced/testing-dependencies/): "your FastAPI application has an attribute app.dependency_overrides"                          | 2026-10-18 |

## Lifespan and settings

| Bullet                     | Source                                                                                                                                                                                                         | Read       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `lifespan`, not `on_event` | [Lifespan Events](https://fastapi.tiangolo.com/advanced/events/): "If you provide a lifespan parameter, startup and shutdown event handlers will no longer be called"                                          | 2026-10-18 |
| Cached `BaseSettings`      | [Settings and Environment Variables](https://fastapi.tiangolo.com/advanced/settings/): with `@lru_cache` "the Settings object will be created only once", and a dependency override replaces it during testing | 2026-10-18 |

## Errors

| Bullet                | Source                                                                                                                                                | Read       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Raise `HTTPException` | [Handling Errors](https://fastapi.tiangolo.com/tutorial/handling-errors/): "To return HTTP responses with errors to the client you use HTTPException" | 2026-10-18 |
| One exception handler | [Handling Errors](https://fastapi.tiangolo.com/tutorial/handling-errors/): "You could add a custom exception handler with @app.exception_handler()"   | 2026-10-18 |
| Safe summaries only   | House choice: an exception message or traceback in a response leaks internals such as SQL, file paths, and library versions to the caller             | 2026-10-18 |

## Middleware

| Bullet                | Source                                                                                                                                                                | Read       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Explicit CORS origins | [CORS](https://fastapi.tiangolo.com/tutorial/cors/): "None of allow_origins, allow_methods and allow_headers can be set to ['*'] if allow_credentials is set to True" | 2026-10-18 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Contradicted by the docs

- Reworded "define path operations as `async def` unless purely CPU-bound". The [async page](https://fastapi.tiangolo.com/async/) says "If you just don't know, use normal def", and CPU work in `async def` blocks the loop too.
- Cut "an `app_factory()` callable over a module-level `app` for testability". Every docs example uses a module-level `app` and tests through `app.dependency_overrides`, which the kept bullet names.

### Cut without a source or a bug class

- Cut "group routers by feature under `src/<pkg>/api/`" as a layout call, which the `codebase-layout` skill owns.
- Cut "annotate path, query, and body parameters, never `**kwargs`", since FastAPI cannot read `**kwargs` and Claude already annotates them.
- Cut "configure trusted hosts and HTTPS redirects through middleware" as a deployment choice with no page read taking a side.

### Merged or reworded

- Merged "mount routes through `APIRouter`, never directly on `FastAPI()`" into the router bullet.
- Reworded "return pydantic models and set `response_model=`" to name the filter, which is the footgun the [Response Model](https://fastapi.tiangolo.com/tutorial/response-model/) page warns about with passwords.
- Merged "express shared logic as `Depends(...)` over decorators or globals" into the `Annotated` bullet.
- Merged "do not perform blocking I/O inside `async def`" into the `async def` bullet.
- Narrowed "configure CORS through middleware, not per-route checks" to the credentials footgun the CORS page states.
- Moved "apply `dependencies=[Depends(auth)]` at the router or app level" to the routers section.
