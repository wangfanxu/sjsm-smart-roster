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

## Real member account migration (built: `scripts/bulk-provision-members.mjs`)

This is narrower than the full event/roster migration above, and addresses a
more immediate need: once Google sign-in (UI-01) is live, a real member
should never have to be manually registered one at a time, and should never
see a "not registered" screen the first time they sign in with their real
email. It also seeds each member's role capabilities (instruments), since
the `roles` reference table has no other source of real data — nothing else
in the app creates role rows, so without this step every member (and the
member-management screen) would show zero role capabilities regardless of
how their account was created.

Account linking (`docs/authentication-and-authorization.md#account-provisioning`)
already supports the account half of this by design — an administrator
pre-provisions a "pending" row by email (`POST /api/v1/users`), and it links
automatically on that email's first Google sign-in. Migrating real members is
therefore **bulk pre-provisioning plus role-capability seeding**, not a new
mechanism:

1. An authorized coordinator exports the real member list (email, display
   name, role, `primaryInstrument`, `secondaryInstruments`) from the legacy
   system into a local file. That file must never enter this repository, CI,
   or any AI conversation — the same safety boundary already enforced for
   the spike above.
2. Map legacy roles to `systemRole` using the mapping already established
   for the spike: `admin` → `administrator`, `*-leader` → `team_leader`,
   otherwise → `volunteer`.
3. Normalize `primaryInstrument`/`secondaryInstruments` into role
   capabilities the same way the full spike does: each instrument name
   becomes a `roles` row (slug derived from the name) with `primary`/
   `secondary` proficiency. A role slug that doesn't exist yet is created
   via `POST /api/v1/roles`, reusing the validated path rather than writing
   to the database directly.
4. Deduplicate by email (case-insensitive). Rows with no email or a
   malformed email cannot be auto-linked and are reported by row position
   only — never by the email or name itself — so the output stays safe to
   share for debugging.
5. `scripts/bulk-provision-members.mjs <export-file-path>` runs the above:
   it authenticates as an administrator (via `ADMIN_EMAIL` + Firebase Admin
   custom-token minting, exchanged for an ID token), calls
   `POST /api/v1/users` once per row, and `PUT /api/v1/users/{id}/roles` to
   set that member's capabilities. `409 email_already_registered` is an
   expected "already provisioned" skip, not a failure — and role
   capabilities are still synced for a skipped (already-registered) member,
   using the existing `GET /api/v1/users` listing to find their id, so
   re-running the script safely keeps capabilities in sync too. All
   console output is counts only (created/skipped/failed/roles created) —
   never personal data.
6. Each member signs in once with Google using that email; the existing
   auto-link claims the row. No re-registration step for them beyond a
   normal sign-in.
7. Optional: notify members their account is ready via the existing
   `EmailSender`/Resend integration (US-09) once a "welcome" template
   exists. Not required — the church could announce it directly instead.

Migrating historical events, services, rosters, or availability from the
legacy system is a separate, larger decision (see "Production follow-up"
above) and is not a prerequisite for real members simply being able to
sign in.
