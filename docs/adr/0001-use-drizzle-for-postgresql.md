# ADR 0001: Use Drizzle for PostgreSQL access and migrations

- Status: Accepted
- Date: 2026-08-27
- Decision owners: Capstone author

## Context

SmartRoster needs a relational model with explicit constraints, version-controlled migrations, and type-safe access from the Next.js backend. The scheduling engine will eventually use joins, aggregates, transactions, partial indexes, and PostgreSQL-specific capabilities. Prisma and Drizzle were considered.

## Decision

Use Drizzle ORM with PostgreSQL. Define the schema in TypeScript, generate reviewable SQL with Drizzle Kit, and commit both the SQL migration and Drizzle metadata. Use `postgres.js` as the production driver and PGlite as an isolated PostgreSQL-compatible integration-test database.

## Rationale

- Generated SQL remains visible and reviewable, which supports Capstone evidence and database-invariant review.
- Drizzle exposes PostgreSQL constraints and indexes without hiding the relational model behind a separate schema language.
- The lightweight runtime and explicit query builder fit Next.js route handlers and future scheduling queries.
- PGlite can execute the actual migration in CI without credentials or a shared test service.

## Consequences

- The team owns SQL-aware schema design and must review every generated migration.
- Application code must still validate inputs; database constraints are a second line of defense.
- Production and PGlite behavior can differ for extensions or provider-specific features, so a managed-PostgreSQL integration check will be added when a provider is selected.
- `updated_at` values must be maintained by write operations; the database only supplies the initial default.

## Alternatives considered

Prisma offers a mature generated client and approachable schema language. It was not selected because this project benefits more from direct PostgreSQL primitives and inspectable SQL for constraint-heavy scheduling work than from a higher-level generated client.
