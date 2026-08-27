# SJSM SmartRoster

An explainable AI-assisted church volunteer scheduling platform that generates fair, conflict-free service rosters and lets volunteers manage their commitments through a conversational assistant.

## Project status

This repository is the new Quantic MSSE Capstone codebase. It does not contain the pre-existing SJSM production application. That application is treated as a legacy reference and pre-Capstone baseline.

Current phase: Sprint 1 foundation.

## Problem

Church service coordinators currently spend significant time creating rosters manually. They must consider member availability, role capability, assignment conflicts, workload fairness, recent service history, and last-minute replacements. The process is difficult to optimize and hard to explain consistently.

SJSM SmartRoster will provide:

- constraint-based roster generation;
- fair workload distribution;
- explainable scheduling decisions;
- human review, locking, regeneration, and publication;
- natural-language access to personal assignments and availability;
- email notifications and reminders.

## Proposed stack

- Next.js App Router for the web application and backend-for-frontend
- PostgreSQL with Prisma or Drizzle for relational domain data
- Firebase Authentication for existing user identities
- Firebase Hosting plus Cloud Run, or Firebase App Hosting, for deployment
- A constraint solver for roster optimization
- An LLM with controlled tool calling for conversational features
- Resend for transactional email
- GitHub Actions for CI/CD

## Local development

Prerequisites:

- Node.js 22 LTS (Next.js requires Node.js 20.9 or newer)
- npm 10 or newer

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The root route redirects to the English experience at `/en`; the Simplified Chinese experience is available at `/zh`.

## Quality checks

Run the same checks used by CI:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The application exposes `GET /api/health` for deployment verification.

`GET /api/v1/me` is protected by Firebase ID-token verification and returns the application profile resolved from the verified Firebase UID. See [authentication and authorization](docs/authentication-and-authorization.md).

## Database

The server domain uses PostgreSQL with Drizzle ORM. Copy `.env.example` to `.env.local`, set `DATABASE_URL`, then use the version-controlled migration workflow:

```bash
npm run db:generate
npm run db:check
npm run db:migrate
```

Tests apply the real migration to a fresh in-memory PostgreSQL instance; they never require or modify a shared database. See the [domain model](docs/domain-model.md) and [Drizzle decision record](docs/adr/0001-use-drizzle-for-postgresql.md).

The synthetic legacy-data spike is reproducible with `npm run migration:legacy-spike`. It refuses non-synthetic email domains and writes only aggregate validation evidence. See the [legacy migration spike](docs/legacy-migration-spike.md).

## Documentation

- [Product specification](docs/product-spec.md)
- [Architecture](docs/architecture.md)
- [Capstone delivery plan](docs/capstone-plan.md)
- [Domain model](docs/domain-model.md)
- [Authentication and authorization](docs/authentication-and-authorization.md)
- [Legacy migration spike](docs/legacy-migration-spike.md)
- [AI coding instructions](AGENTS.md)

## Core principle

AI proposes and explains. Authorized humans review and decide.
