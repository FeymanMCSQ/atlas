# Engineering Principles

This document defines the core engineering philosophy for this repository.

All code written for this system must follow these principles.

These principles exist to keep the system:

- maintainable
- modular
- predictable
- safe to evolve

They take precedence over convenience.

---

# 1. Clear Separation of Responsibilities

Each service has a well-defined domain responsibility.

Responsibilities must **not leak across services**.

Examples:

- Feed ingestion belongs only to `feed-ingestor`
- AI content generation belongs only to `content-brain`
- Publishing belongs only to `publisher`
- Workflow coordination belongs only to `orchestrator`

Services must **not perform work outside their domain**.

---

# 2. Shared Truth Lives in Packages

Common logic must live in shared packages.

Examples:


packages/domain → shared types and schemas
packages/db → database access
packages/queue → event definitions
packages/integrations → external API clients
packages/prompts → AI prompt templates


Applications should import shared logic rather than duplicating it.

---

# 3. Event-Driven Workflows

Services communicate through events.

Services must **not call each other’s internal logic directly**.

Communication occurs via:

- event queue
- database state transitions

This prevents tight coupling.

---

# 4. Single Responsibility per Module

Each module must have one clear responsibility.

Avoid files that combine:

- business logic
- API logic
- persistence logic
- integration logic

Prefer small focused modules.

---

# 5. Pure Logic Where Possible

Business logic should be written as **pure functions** whenever possible.

Benefits:

- easier testing
- easier reasoning
- fewer side effects

Side effects should be isolated to:

- integrations
- database writes
- queue operations

---

# 6. Immutable Source Data

Raw source data must never be modified.

Examples:

- original feed content
- transcript text

Processing steps should generate **new derived records**, not mutate originals.

---

# 7. Idempotent Operations

Workers must tolerate retries.

Any job that can be executed twice must not cause corruption.

Examples:

- publishing must detect duplicate attempts
- event handlers must tolerate repeated events

---

# 8. Observability by Default

All important operations must produce logs.

Critical operations should include:

- job identifiers
- content identifiers
- platform identifiers
- error information

Logs should enable debugging without attaching a debugger.

---

# 9. Simplicity Over Cleverness

Prefer clear code over clever code.

Avoid:

- unnecessary abstractions
- premature optimization
- complex dependency graphs

A developer unfamiliar with the system should be able to understand the code quickly.

---

# 10. Backward-Compatible Evolution

Changes to:

- database schema
- event payloads
- service interfaces

must preserve backward compatibility whenever possible.

Breaking changes require explicit versioning.