# SJSM SmartRoster

An explainable AI-assisted church volunteer scheduling platform that generates fair, conflict-free service rosters and lets volunteers manage their commitments through a conversational assistant.

## Project status

This repository is the new Quantic MSSE Capstone codebase. It does not contain the pre-existing SJSM production application. That application is treated as a legacy reference and pre-Capstone baseline.

All four planned sprints are complete: the Sprint 1-3 server API and domain model, and the Sprint 4 authenticated frontend (sign-in, volunteer dashboard, assistant chat, administrator roster workflow, member management, and several follow-on UI stories — service songs, replacement/coverage requests, a WhatsApp message template generator, and more). The only open item is [OPS-01](https://github.com/wangfanxu/sjsm-smart-roster/issues/41), bulk-provisioning real church member accounts, which is operational rather than a product gap.

- **Live deployment:** https://smart-roster--sjsm-smart-roster.asia-southeast1.hosted.app/en
- **Task board:** [GitHub Project](https://github.com/users/wangfanxu/projects/1)
- **Design and testing record:** [docs/design-and-testing.md](docs/design-and-testing.md)

## Problem

Church service coordinators currently spend significant time creating rosters manually. They must consider member availability, role capability, assignment conflicts, workload fairness, recent service history, and last-minute replacements. The process is difficult to optimize and hard to explain consistently.

SJSM SmartRoster provides:

- constraint-based roster generation;
- fair workload distribution;
- explainable scheduling decisions;
- human review, locking, regeneration, and publication;
- natural-language access to personal assignments and availability;
- email notifications and reminders;
- a bilingual (English/Simplified Chinese) authenticated web application for both volunteers and administrators.

## Stack

- Next.js App Router for the web application and backend-for-frontend
- PostgreSQL with Drizzle ORM for relational domain data (see [ADR 0001](docs/adr/0001-use-drizzle-for-postgresql.md))
- Firebase Authentication for existing user identities
- Firebase App Hosting and Neon PostgreSQL for deployment (see [ADR 0002](docs/adr/0002-use-firebase-app-hosting-and-neon.md))
- A constraint solver for roster optimization
- Gemini (with controlled tool calling) for conversational features (see [ADR 0003](docs/adr/0003-use-gemini-flash-lite-for-assistant-classification.md))
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

## Signing in

Sign-in uses Google, via Firebase Authentication. There is no self-registration — an administrator must pre-provision your account by email first (`POST /api/v1/users`); your Google sign-in then links to it automatically the first time. Copy `.env.example` to `.env.local` for the Firebase Web SDK config (`NEXT_PUBLIC_FIREBASE_*` — not secret, safe to commit as an example since Firebase security comes from Auth + server-side authorization, not from hiding these values). See [authentication and authorization](docs/authentication-and-authorization.md#account-provisioning) for the full flow.

## Quality checks

Run the same checks used by CI:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The application exposes `GET /api/health` for deployment verification. Firebase App Hosting and Neon PostgreSQL are the selected low-traffic deployment path; see the [deployment runbook](docs/deployment.md) and [hosting ADR](docs/adr/0002-use-firebase-app-hosting-and-neon.md).

`GET /api/v1/me` is protected by Firebase ID-token verification and returns the application profile resolved from the verified Firebase UID. See [authentication and authorization](docs/authentication-and-authorization.md).

Sprint 1 planning, service, member-role, personal availability, and upcoming-assignment operations are exposed under `/api/v1`. Sprint 2 adds roster generation, review, locking/regeneration, and publication. Sprint 3 adds the conversational assistant and email notifications. Sprint 4 is an authenticated frontend (`src/app/[locale]/(app)`) for every one of the above, plus follow-on stories (member management, manual reassignment, replacement/coverage requests, self-service profile, service songs, a WhatsApp message template generator). See the [server API contract](docs/api.md).

## Conversational assistant

`POST /api/v1/assistant/ask` answers a volunteer's question about their own next assignment, or prepares a conversational "mark me unavailable" request, in English or Chinese. `POST /api/v1/assistant/confirm` executes a prepared availability write — nothing is written until the volunteer explicitly confirms. It requires `GEMINI_API_KEY` (and optionally `ASSISTANT_MODEL`, default `gemini-3.1-flash-lite`) and `ASSISTANT_CONFIRMATION_SECRET` (signs confirmation tokens) in the environment; automated tests never call the real API. The free Gemini tier is used for the Capstone demo only — see [ADR 0003](docs/adr/0003-use-gemini-flash-lite-for-assistant-classification.md) before sending real member data through it. Evaluate representative English and Chinese prompts, including relative-date resolution, against the real model with:

```bash
GEMINI_API_KEY=... npm run assistant:eval
```

## Email notifications

Publishing a roster sends one digest email per assigned volunteer (`src/notifications/`). Delivery status is recorded in `notification_deliveries`; a send failure is logged there and never affects the publish response or the candidate's status. Requires `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL` in the environment; automated tests never call the real API.

## Database

The server domain uses PostgreSQL with Drizzle ORM. Copy `.env.example` to `.env.local`, set `DATABASE_URL`, then use the version-controlled migration workflow:

```bash
npm run db:generate
npm run db:check
npm run db:migrate
```

Tests apply the real migration to a fresh in-memory PostgreSQL instance; they never require or modify a shared database. See the [domain model](docs/domain-model.md) and [Drizzle decision record](docs/adr/0001-use-drizzle-for-postgresql.md).

The synthetic legacy-data spike is reproducible with `npm run migration:legacy-spike`. It refuses non-synthetic email domains and writes only aggregate validation evidence. See the [legacy migration spike](docs/legacy-migration-spike.md).

## Project tracking

- [Task board (GitHub Project)](https://github.com/users/wangfanxu/projects/1) — sprint backlog, user stories, and tasks with completion status
- [Issue tracker](https://github.com/wangfanxu/sjsm-smart-roster/issues) — full history of user stories and tasks delivered

## Documentation

- [Design and testing document](docs/design-and-testing.md) — architecture and testing decisions in one place, as required for the Capstone submission
- [Product specification](docs/product-spec.md)
- [Architecture](docs/architecture.md)
- [Capstone delivery plan](docs/capstone-plan.md)
- [Domain model](docs/domain-model.md)
- [Authentication and authorization](docs/authentication-and-authorization.md)
- [Legacy migration spike](docs/legacy-migration-spike.md)
- [Server API](docs/api.md)
- [Deployment runbook](docs/deployment.md)
- [Hosting and database ADR](docs/adr/0002-use-firebase-app-hosting-and-neon.md)
- [Assistant LLM provider ADR](docs/adr/0003-use-gemini-flash-lite-for-assistant-classification.md)
- [AI coding instructions](AGENTS.md)

## Core principle

AI proposes and explains. Authorized humans review and decide.
