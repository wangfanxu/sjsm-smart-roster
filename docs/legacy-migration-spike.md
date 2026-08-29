# Legacy Firebase Migration Spike

## Safety boundary

This spike was derived from application code in the private legacy repositories, not from a Firestore export. The committed fixture is intentionally synthetic, uses reserved `example.test` email addresses, and is marked `containsPersonalData: false`. The transformer refuses any fixture that is not explicitly synthetic or contains a non-test email domain.

Real exports must remain outside Git, CI, the Capstone demonstration environment, and any AI prompt. A future production migration would run in an approved, access-controlled environment and produce only aggregate validation evidence.

## Relevant legacy collections

| Collection | Relevant fields observed in legacy code | New model |
| --- | --- | --- |
| `users` | document ID/Firebase UID, `email`, `displayName`, `role`, `primaryInstrument`, `secondaryInstruments`, `isActive` | `users`, `roles`, `user_roles` |
| `events` | `title`, Firestore `date`, `time`, `notes`, `status`, role-to-user map in `roles` | `planning_periods`, `services`, `service_role_requirements`, `roster_candidates`, `assignments` |
| `availability` | `userId`, Firestore `date`, `isAvailable`, `note` | `availability` |
| `serviceRequests` | `eventId`, `requesterId`, `replacementId`, `role`, `reason`, `status` | `replacement_requests` |

`verificationCodes` is authentication bootstrap data and is deliberately excluded. Song-management data is outside the SmartRoster MVP migration scope.

## Transformation decisions

- Legacy Firebase UID document IDs are preserved as deterministic mappings, not copied into PostgreSQL primary keys.
- Synthetic Firebase UIDs use a `synthetic:` prefix; target UUIDs are deterministic so repeated runs produce identical artifacts.
- Legacy `admin`, `*-leader`, and other roles map to `administrator`, `team_leader`, and `volunteer` respectively.
- Instrument names become normalized role rows and primary/secondary qualifications.
- The implicit two-month legacy period is supplied as explicit migration metadata.
- Each event becomes a service. Keys in `events.roles` become requirements; populated values become manual assignments in one draft candidate.
- Availability is exception-based in the legacy UI, so only `isAvailable: false` becomes an `unavailable` row.
- A pending service request becomes an open replacement request linked to the original assignment.
- Imported work remains a draft. The migration never publishes a roster.

## Run and verify

```bash
npm run migration:legacy-spike
npm test
```

The command deterministically rewrites:

- `artifacts/migration/legacy-migration.sql`
- `artifacts/migration/legacy-migration-report.json`

Tests create a fresh in-memory PostgreSQL instance, apply the version-controlled schema migration, apply the generated transformation SQL, and verify record counts and foreign-key relationships.

## Production follow-up

Before any real adoption, an authorized coordinator must approve the collection mapping, planning-period boundaries, timezone, inferred role capacities, user-role normalization, and draft roster results. The final process should compare aggregate source/target counts and sample approved records without copying personal values into Capstone evidence.

## Real member account migration (plan; not yet built)

This is narrower than the full event/roster migration above, and addresses a
more immediate need: once Google sign-in (UI-01) is live, a real member
should never have to be manually registered one at a time, and should never
see a "not registered" screen the first time they sign in with their real
email.

Account linking (`docs/authentication-and-authorization.md#account-provisioning`)
already supports this by design — an administrator pre-provisions a
"pending" row by email (`POST /api/v1/users`), and it links automatically
on that email's first Google sign-in. Migrating real members is therefore
**bulk pre-provisioning**, not a new mechanism:

1. An authorized coordinator exports the real member list (email, display
   name, role) from the legacy system into a local file. That file must
   never enter this repository, CI, or any AI conversation — the same
   safety boundary already enforced for the spike above.
2. Map legacy roles to `systemRole` using the mapping already established
   for the spike: `admin` → `administrator`, `*-leader` → `team_leader`,
   otherwise → `volunteer`.
3. Deduplicate by email (case-insensitive). Rows with no email or a
   malformed email cannot be auto-linked and need a separate manual-invite
   plan once an email is available for them.
4. Run a bulk-provisioning script (to be written when this moves from plan
   to build) that authenticates as an administrator and calls
   `POST /api/v1/users` once per row — reusing the same validated path a
   single manual invite already goes through, rather than writing directly
   to the database. Treat `409 email_already_registered` as an expected
   "already provisioned" skip, not a failure. The script's output must be
   counts only (created/skipped/failed) — never personal data — in
   anything that could leave the operator's machine.
5. Each member signs in once with Google using that email; the existing
   auto-link claims the row. No re-registration step for them beyond a
   normal sign-in.
6. Optional: notify members their account is ready via the existing
   `EmailSender`/Resend integration (US-09) once a "welcome" template
   exists. Not required — the church could announce it directly instead.

Migrating historical events, services, rosters, or availability from the
legacy system is a separate, larger decision (see "Production follow-up"
above) and is not a prerequisite for real members simply being able to
sign in.
