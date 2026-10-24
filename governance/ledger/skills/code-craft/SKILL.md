---
title: Code craft skill ledger
description: Sources for claude/skills/code-craft/SKILL.md, one row per bullet in its concern groups
---

# Code craft skill ledger

The field is software design at writing time. Parnas, Ousterhout, Fowler, and the Pragmatic Programmer authors carry decomposition and duplication, Refactoring Guru carries the smells, and Birgitta Böckeler's two articles record how agents fail. The closing sections and `## What this delegates` restate these rules or route, so they take no table.

Parnas's paper refused a read at its ACM DOI, `10.1145/361598.361623`, so the rows quote an open copy of the same paper.

## Name the next change first

| Bullet                             | Source                                                                                                                                                                                                                                                               | Read       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Name the likely next change first  | [Parnas, On the Criteria To Be Used in Decomposing Systems into Modules](https://www.win.tue.nl/~wstomv/edu/2ip30/references/criteria_for_modularization.pdf): "one begins with a list of difficult design decisions or design decisions which are likely to change" | 2026-10-24 |
| The shape touching one place wins  | [Fowler, Reducing Coupling](https://martinfowler.com/ieeeSoftware/coupling.pdf): "If changing one module in a program requires changing another module, then coupling exists."                                                                                       | 2026-10-24 |
| No named change, the plainest code | [Google, What to look for in a code review](https://google.github.io/eng-practices/review/reviewer/looking-for.html): "solve the problem they know needs to be solved now, not the problem that the developer speculates might need to be solved in the future"      | 2026-10-24 |

## Earn depth

| Bullet                             | Source                                                                                                                                                                                                                                                   | Read       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Inline a pass-through              | [Refactoring Guru, Middle Man](https://refactoring.guru/smells/middle-man): "If a class performs only one action, delegating work to another class, why does it exist at all?"                                                                           | 2026-10-24 |
| Split by the decision hidden       | [Parnas, On the Criteria](https://www.win.tue.nl/~wstomv/edu/2ip30/references/criteria_for_modularization.pdf): "Each module is then designed to hide such a decision from the others", so modules "will not correspond to steps in the processing"      | 2026-10-24 |
| One decision in one unit           | [Refactoring Guru, Shotgun Surgery](https://refactoring.guru/smells/shotgun-surgery): "Making any modifications requires that you make many small changes to many different classes."                                                                    | 2026-10-24 |
| One longer function over tiny ones | [Ousterhout and Martin, A Philosophy of Software Design vs Clean Code](https://github.com/johnousterhout/aposd-vs-clean-code): readers "have to flip back and forth between the methods, effectively reconstructing a monolithic version in their minds" | 2026-10-24 |

## Weigh the tensions

| Bullet                                   | Source                                                                                                                                                                                                                                                              | Read       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| One piece of knowledge, one place        | [Hunt and Thomas, Orthogonality and the DRY Principle](https://www.artima.com/articles/orthogonality-and-the-dry-principle): "Most people take DRY to mean you shouldn't duplicate code. That's not its intention."                                                 | 2026-10-24 |
| Only what is asked, seams allowed        | [Fowler, Yagni](https://martinfowler.com/bliki/Yagni.html): Yagni "only applies to capabilities built into the software to support a presumptive feature, it does not apply to effort to make the software easier to modify"                                        | 2026-10-24 |
| One reason to change, not too many parts | [Ousterhout and Martin, A Philosophy of Software Design vs Clean Code](https://github.com/johnousterhout/aposd-vs-clean-code): two methods are entangled "if, in order to understand how one of them works internally, you also need to read the code of the other" | 2026-10-24 |

## Pass hidden inputs in

| Bullet                                    | Source                                                                                                                                                                                                                                                                  | Read       |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Clock, environment, and globals passed in | [Fowler, Inversion of Control Containers and the Dependency Injection pattern](https://martinfowler.com/articles/injection.html): "to do testing, you need to easily replace real service implementations with stubs or mocks"                                          | 2026-10-24 |
| Rules free of transport and storage       | [Cockburn, Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/): an application "developed and tested in isolation from its eventual run-time devices and databases"                                                                           | 2026-10-24 |
| No ports and adapters for record CRUD     | [Microsoft, Design a DDD-oriented microservice](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/ddd-oriented-microservice): "Simpler responsibilities, like a CRUD service, can be managed with simpler approaches." | 2026-10-24 |

## Check your own diff

| Bullet                                  | Source                                                                                                                                                                                                                                                        | Read       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| A copy where a change belonged          | [Böckeler, The role of developer skills in agentic coding](https://martinfowler.com/articles/exploring-gen-ai/13-role-of-developer-skills.html): "Not realising that a UI component is already implemented elsewhere, and therefore creating duplicate code"  | 2026-10-24 |
| One responsibility across files         | [Refactoring Guru, Shotgun Surgery](https://refactoring.guru/smells/shotgun-surgery): "A single responsibility has been split up among a large number of classes."                                                                                            | 2026-10-24 |
| A feature nobody asked for              | [Böckeler, How far can we push AI autonomy in code generation?](https://martinfowler.com/articles/pushing-ai-autonomy.html): "We frequently got additional endpoints and features that we did not ask for in the requirements."                               | 2026-10-24 |
| An assumption where a question belonged | [Böckeler, How far can we push AI autonomy in code generation?](https://martinfowler.com/articles/pushing-ai-autonomy.html): "Gaps in the requirements will be filled with assumptions", as when a priority field "was assumed by AI to have the value set"   | 2026-10-24 |
| A brute-force fix                       | [Böckeler, The role of developer skills in agentic coding](https://martinfowler.com/articles/exploring-gen-ai/13-role-of-developer-skills.html): "AI sometimes took brute-force approaches to solve issues rather than diagnosing what actually caused them." | 2026-10-24 |
