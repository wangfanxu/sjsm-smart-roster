# ADR 0002: Use Firebase App Hosting and Neon PostgreSQL

- Status: Accepted
- Date: 2026-08-27
- Decision owners: Capstone author
- Related issue: #14

## Context

SmartRoster needs a low-maintenance deployment path for a Next.js application with server-rendered pages, route handlers, Firebase Authentication, PostgreSQL, secrets, logs, and automated releases. Traffic will initially be low and intermittent, so idle cost matters more than sustained-throughput optimization.

The legacy application used Firebase Hosting and browser-to-Firestore access. The new application has a trusted Next.js server boundary and therefore cannot be deployed as static files alone.

## Decision

Deploy the Next.js application with **Firebase App Hosting** in `asia-southeast1` and use **Neon PostgreSQL** in its Singapore region.

- App Hosting builds from the GitHub `main` branch, runs the application on Cloud Run, and serves it through its managed CDN and public `hosted.app` domain.
- `apphosting.yaml` keeps `minInstances` at zero and caps `maxInstances` at three for this low-traffic stage.
- `DATABASE_URL` is a runtime-only Cloud Secret Manager reference. No database password or Firebase service-account key is stored in GitHub.
- The application uses Neon's pooled connection string at runtime. Migrations use an authorized direct connection from an operator environment.
- Firebase Admin uses Application Default Credentials and App Hosting's automatically supplied Firebase configuration.
- The initial release uses the platform-provided domain. A custom domain is deferred until it provides user value.

## Options considered

| Option | SSR and APIs | Delivery and rollback | Secrets and observability | Low-traffic cost | Decision |
| --- | --- | --- | --- | --- | --- |
| Firebase App Hosting | Native Next.js support | GitHub rollouts; instant or rebuild rollback | Secret Manager, Cloud Logging, route metrics | Blaze billing required; scale-to-zero and no-cost quotas | Selected |
| Firebase Hosting + Cloud Run rewrite | Full support after containerization | Separate image build, Cloud Run deploy, and Hosting deploy | Secret Manager and Cloud Logging, but more IAM/configuration | Similar request-based runtime cost | Rejected for avoidable operational work |
| Vercel + managed PostgreSQL | Excellent Next.js support | Simple Git integration and rollback | Integrated environment variables and logs | Attractive free tier | Rejected to preserve the existing Firebase operational boundary |
| Firebase Hosting only | Static content only | Simple | Firebase configuration | Lowest | Rejected because Next.js route handlers require a server runtime |

## Cost implications

App Hosting requires the Firebase project to use the pay-as-you-go Blaze plan and therefore requires a billing account. Its underlying Cloud Run service can scale to zero. Firebase's published example estimates approximately USD 0.01 at 10,000 monthly visits under its stated assumptions, but this is not a price guarantee. Configure billing alerts before the first deployment and retain the `maxInstances` cap.

Neon's Free plan currently provides 0.5 GB storage and 100 CU-hours per project, with idle compute scaling to zero. That is sufficient for the Capstone and a small church pilot. Scale-to-zero can add a cold-start delay after inactivity. Usage and pricing must be reviewed before production adoption or loading real member data.

## Consequences

### Positive

- One managed deployment surface for the Next.js UI and API.
- No custom container or Firebase rewrite configuration is needed.
- GitHub-linked rollout history and platform rollback improve Capstone evidence.
- Singapore application and database regions reduce network latency.
- Secret Manager and Application Default Credentials remove long-lived keys from the repository.

### Trade-offs

- A billing account is mandatory even when usage remains within no-cost quotas.
- App Hosting introduces Firebase-specific deployment configuration.
- Neon Free compute sleeps when idle, so the first database-backed request may be slower.
- The application and database run on different cloud providers and require a public TLS database connection.

## Revisit when

- sustained traffic or cold-start requirements justify minimum instances;
- storage or compute exceeds Neon Free limits;
- production privacy requirements call for private networking or a single-cloud database;
- the church requires contractual support, stronger recovery objectives, or a custom domain.
