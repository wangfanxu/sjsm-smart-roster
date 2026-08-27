# Domain Model

The PostgreSQL model is the authoritative foundation for SmartRoster. TypeScript declarations live in `src/db/schema.ts`; generated, version-controlled SQL lives in `drizzle/`.

## Entity groups

| Area | Tables | Purpose |
| --- | --- | --- |
| Identity | `users`, `roles`, `user_roles` | Firebase-linked users, authorization role, and service-role qualifications |
| Planning | `planning_periods`, `services`, `service_role_requirements`, `availability` | Dates, services, required capacity, and volunteer date preferences |
| Optimization | `scheduling_constraints`, `roster_candidates`, `assignments` | Solver inputs, versioned outputs, scores, explanations, and locked assignments |
| Operations | `replacement_requests`, `notification_deliveries`, `audit_events` | Replacement workflow, retry-safe email delivery, and immutable activity evidence |

## Key relationships and invariants

- A planning period owns services, constraints, and versioned roster candidates.
- A service has one requirement row per service role; capacity must be greater than zero.
- Availability is unique per volunteer and calendar date, matching the conversational `mark_unavailable` intent.
- A candidate version is unique within its planning period, and no more than one candidate can be published for that period.
- A published candidate must report that all hard constraints were satisfied.
- A volunteer can hold only one role in a service within a candidate roster.
- Notification deliveries use a globally unique idempotency key so retries cannot create duplicate sends.
- Destructive cascades are limited to owned planning data. User and role references on historical operational records use `RESTRICT` or `SET NULL` to preserve evidence.

## Timestamps

Mutable tables have `created_at` and `updated_at` timestamps. Database defaults set both when a row is created; repository/service write operations are responsible for advancing `updated_at`. Generated candidates use `generated_at`, notifications may use `sent_at`, and audit events are append-only with `created_at`.

## Migration workflow

1. Change `src/db/schema.ts`.
2. Run `npm run db:generate` and review the generated SQL.
3. Run `npm run db:check` and `npm test`.
4. Apply committed migrations with `DATABASE_URL=... npm run db:migrate`.

Development and tests must use synthetic data. No Firebase exports or real member records belong in this repository.
