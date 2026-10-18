---
title: Next.js rule ledger
description: Sources for governance/rules/framework/nextjs.md, one row per bullet
---

# Next.js rule ledger

The field is front-end engineering, and the authority is the Next.js documentation at nextjs.org, read against the App Router docs for Next.js 16. The rule loads on every `.ts` and `.tsx` file in a target, so the rewrite cut it from 352 words to under 250.

## Routing

| Bullet                   | Source                                                                                                                                                                                      | Read                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| App Router, not `pages/` | House choice: a second router in one app splits layouts, data fetching, and caching across two models, so a change made in one never reaches routes in the other                            | 2026-10-18             |
| Await `params`           | [route.js](https://nextjs.org/docs/app/api-reference/file-conventions/route): "`context.params` is now a promise" since v15, and every page example types `params: Promise<{ id: string }>` | 2026-10-18, Next.js 16 |

## Server and client components

| Bullet                          | Source                                                                                                                                                                                                                                                      | Read                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Server by default               | [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components): "By default, layouts and pages are Server Components", with Client Components for state, event handlers, lifecycle logic, and browser-only APIs   | 2026-10-18, Next.js 16 |
| `'use client'` at the leaf      | [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components): "add 'use client' at the top of the files that define your interactive components instead of marking large parts of your UI as Client Components" | 2026-10-18, Next.js 16 |
| Serializable, minimal props     | [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components): props "need to be serializable", and [Data Security](https://nextjs.org/docs/app/guides/data-security) marks passing a whole row as "EXPOSED"     | 2026-10-18, Next.js 16 |
| `server-only` on secret modules | [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components): "To prevent accidental usage in Client Components, you can use the server-only package"                                                           | 2026-10-18, Next.js 16 |

## Data and caching

| Bullet                           | Source                                                                                                                                                                                                                                                    | Read                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `'use cache'` with `cacheLife`   | [Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data): "fetch requests are not cached by default", and [Caching](https://nextjs.org/docs/app/getting-started/caching): "We recommend pairing every cache directive with a cacheLife" | 2026-10-18, Next.js 16 |
| `<Suspense>` around runtime data | [Caching](https://nextjs.org/docs/app/getting-started/caching): "Components that access runtime APIs should be wrapped in Suspense"                                                                                                                       | 2026-10-18, Next.js 16 |
| Revalidate after a mutation      | [Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data): "you can revalidate the Next.js cache and show the updated data by calling revalidatePath or revalidateTag within the Server Function"                                        | 2026-10-18, Next.js 16 |

## Mutations

| Bullet                        | Source                                                                                                                                                                                                                                                      | Read                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Verify auth inside the action | [Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data): "Server Functions are reachable via direct POST requests, not just through your application's UI. Always verify authentication and authorization inside every Server Function." | 2026-10-18, Next.js 16 |
| Validate input, trim output   | [Data Security](https://nextjs.org/docs/app/guides/data-security): "You should always validate input from client", and "Only return what the UI needs, not raw database records"                                                                            | 2026-10-18, Next.js 16 |

## Built-in primitives

| Bullet                       | Source                                                                                                                                                                                                                                  | Read                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `next/link` and `next/image` | [Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating): "Next.js automatically prefetches routes linked with the Link component", and a plain anchor gets "No prefetching"                        | 2026-10-18, Next.js 16 |
| Image dimensions or `fill`   | [Image Component](https://nextjs.org/docs/app/api-reference/components/image): "If the source image is a dynamic or a remote URL, you must provide the width and height props", and with `fill` "the parent element must be positioned" | 2026-10-18, Next.js 16 |

## Environment

| Bullet                          | Source                                                                                                                                                                                                                                                 | Read                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| `NEXT_PUBLIC_` only when needed | [Environment Variables](https://nextjs.org/docs/app/guides/environment-variables): Next.js can "inline a value, at build time, into the js bundle that is delivered to the client", and the values are "frozen with the value evaluated at build time" | 2026-10-18, Next.js 16 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Contradicted by the docs

- Replaced "set explicit caching on every `fetch`" with the `'use cache'` bullet. New apps run Cache Components, which [Caching](https://nextjs.org/docs/app/getting-started/caching) drives through the directive.
- Cut "return `NextResponse` over raw `Response`", since the [route.js](https://nextjs.org/docs/app/api-reference/file-conventions/route) reference returns the Web `Response` throughout.
- Cut "read params from the function signature, not the request URL" as stale. The signature form holds, and the kept bullet adds the `await` the current major requires.
- Cut "return no `Response` or stream from a Server Action". No page read forbids it, and the kept bullet states what the docs do say about return values.

### Cut without a source or a bug class

- Cut "use route segment files for their documented purpose" as a convention Claude already follows.
- Cut "place HTTP endpoints in `app/**/route.ts`, never `pages/api/`" as covered by the App Router bullet.
- Cut "export named HTTP methods" as enforced by the framework, which only routes the named exports.
- Cut "export `metadata` or `generateMetadata` over manual head tags" as a convention Claude already follows.

### Cut for the word budget

A sourced practice cut only because the rule loads on every TypeScript file. A later pass with room can bring it back.

- Cut "use `next/font` over manual link tags", which the docs still recommend.

### Merged or reworded

- Merged "do not fetch in client components when a server alternative exists" into the server-by-default bullet, since the docs list fetching among a Server Component's uses.
- Merged "do not introduce `pages/` in new code" into the App Router bullet.
- Merged "push the boundary as deep as possible" into the leaf bullet.
- Merged "mark Server Actions with `'use server'`", which the build requires, into the mutation bullets.
- Reworded "validate Server Action inputs with a Zod schema" to any validation, since [Data Security](https://nextjs.org/docs/app/guides/data-security) names no library.
- Reworded "use `revalidatePath` or `revalidateTag` over manual refetch loops" to the call the mutation page shows.
- Merged "never read unprefixed env vars in a client component" into the env bullet, since [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) says "If variables are not prefixed, Next.js replaces them with an empty string".
