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
