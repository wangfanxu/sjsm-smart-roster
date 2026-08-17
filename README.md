# SJSM SmartRoster

An explainable AI-assisted church volunteer scheduling platform that generates fair, conflict-free service rosters and lets volunteers manage their commitments through a conversational assistant.

## Project status

This repository is the new Quantic MSSE Capstone codebase. It does not contain the pre-existing SJSM production application. That application is treated as a legacy reference and pre-Capstone baseline.

Current phase: specification and architecture.

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

## Documentation

- [Product specification](docs/product-spec.md)
- [Architecture](docs/architecture.md)
- [Capstone delivery plan](docs/capstone-plan.md)
- [AI coding instructions](AGENTS.md)

## Core principle

AI proposes and explains. Authorized humans review and decide.

