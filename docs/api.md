# Server API

All versioned endpoints use JSON and live under `/api/v1`. Protected requests send a Firebase ID token as `Authorization: Bearer <token>`. Identity and role are resolved at the server boundary; no endpoint accepts a client-supplied current-user ID.

## Endpoints

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/me` | Authenticated | Current application profile |
| `GET` | `/api/v1/planning-periods` | Authenticated | List planning periods |
| `POST` | `/api/v1/planning-periods` | Administrator | Create a planning period |
| `GET` | `/api/v1/planning-periods/{periodId}/services` | Authenticated | List period services chronologically |
| `POST` | `/api/v1/planning-periods/{periodId}/services` | Administrator | Create a service and role requirements |
| `POST` | `/api/v1/planning-periods/{periodId}/candidates` | Administrator | Generate and store a draft roster candidate |
| `GET` | `/api/v1/planning-periods/{periodId}/candidates` | Administrator | List roster candidates for a period, newest version first |
| `GET` | `/api/v1/planning-periods/{periodId}/candidates/{candidateId}` | Administrator | Get a roster candidate's score, explanation, and enriched assignments |
| `PATCH` | `/api/v1/planning-periods/{periodId}/candidates/{candidateId}/assignments/{assignmentId}` | Administrator | Lock or unlock an assignment on a draft candidate |
| `POST` | `/api/v1/planning-periods/{periodId}/candidates/{candidateId}/regenerate` | Administrator | Regenerate a candidate, keeping locked assignments and recalculating the rest |
| `POST` | `/api/v1/planning-periods/{periodId}/candidates/{candidateId}/publish` | Administrator | Publish a draft candidate as the period's official roster |
| `GET` | `/api/v1/roles` | Authenticated | List service-role definitions |
| `PUT` | `/api/v1/users/{userId}/roles` | Administrator | Replace a member's role capabilities |
| `GET` | `/api/v1/me/availability` | Authenticated self | Read personal availability |
| `PUT` | `/api/v1/me/availability` | Authenticated self | Upsert personal availability |
| `GET` | `/api/v1/me/assignments` | Authenticated self | List personal assignments from published rosters |
| `POST` | `/api/v1/assistant/ask` | Authenticated self | Ask the conversational assistant a supported question |
| `POST` | `/api/v1/assistant/confirm` | Authenticated self | Execute a previously prepared conversational availability write |

## Validation rules

- Calendar dates use `YYYY-MM-DD`; actual calendar validity is checked.
- Availability dates are evaluated in `Asia/Singapore`. Today and future dates may be changed; past dates return `past_availability_date`.
- Availability queries default to today through 90 days later and cannot exceed 366 days.
- Service timestamps must include an offset and fall inside the selected planning period in Singapore time.
- A service requires at least one role, every role must exist, capacities are integers from 1 through 20, and duplicate role requirements are rejected.
- A member can have each role only once, as either `primary` or `secondary`.
- Upcoming assignments default to the current instant, are ordered chronologically, and include only the authenticated user and a published candidate roster.
- Candidate-generation weights are integers from 0 through 100. Omitted weights use the documented defaults.

## Personal availability example

```http
PUT /api/v1/me/availability
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{
  "serviceDate": "2026-09-12",
  "status": "unavailable",
  "note": "Away"
}
```

The server injects the authenticated user as both subject and actor. The availability change and its audit event are written in one transaction. Unknown fields such as `userId` are discarded and cannot redirect the write.

## Assignment response

```json
{
  "assignments": [
    {
      "assignmentId": "...",
      "serviceId": "...",
      "startsAt": "2026-09-05T01:00:00.000Z",
      "serviceDate": "2026-09-05",
      "serviceTime": "09:00",
      "title": "Worship Service",
      "role": "Drummer"
    }
  ]
}
```

An empty result returns `assignments: []` and the message `No upcoming assignments found`.

## Scheduling boundary

Candidate generation uses deterministic maximum bipartite matching per service. It excludes inactive, unavailable, and unqualified volunteers and prevents one volunteer from filling multiple roles in the same service. Matching is ordered by configurable primary-role, preferred-availability, and load-balance weights. A generation with missing capacity is still stored as a draft with `hardConstraintsSatisfied: false` and structured `unfilledRoles`; it is never published automatically.

## Candidate generation example

```http
POST /api/v1/planning-periods/{periodId}/candidates
Authorization: Bearer <administrator-firebase-id-token>
Content-Type: application/json

{
  "weights": {
    "primaryRole": 10,
    "preferredAvailability": 5,
    "loadBalance": 2
  }
}
```

The response contains the stored draft candidate, its generated assignments, and any unfilled required roles. Generation configuration, objective score, structured feasibility explanation, actor, and version are persisted atomically with an audit event.

## Reviewing a roster candidate

`GET /api/v1/planning-periods/{periodId}/candidates` returns every stored candidate
version for the period (`draft`, `published`, or `superseded`), each with its
`objectiveScore` and full `explanation`, so an administrator can compare
generations before deciding what to publish.

`GET /api/v1/planning-periods/{periodId}/candidates/{candidateId}` returns one
candidate's full configuration and explanation together with its assignments,
each enriched with the service title/date, role name, and volunteer display
name (not just IDs) so it is directly reviewable. A candidate ID that does not
belong to the given period returns `roster_candidate_not_found`.

```json
{
  "candidate": {
    "id": "...",
    "planningPeriodId": "...",
    "version": 2,
    "status": "draft",
    "hardConstraintsSatisfied": true,
    "objectiveScore": "2018.0000",
    "configuration": { "algorithm": "deterministic-bipartite-matching-v1", "weights": { "primaryRole": 10, "preferredAvailability": 5, "loadBalance": 2 } },
    "explanation": {
      "coverage": { "totalRequired": 2, "totalAssigned": 2, "unfilledCount": 0, "coveragePercentage": 100 },
      "fairness": { "assignmentCountsByUser": { "...": 1 }, "minAssignments": 1, "maxAssignments": 1, "meanAssignments": 1, "spread": 0 },
      "primaryAssignments": 2,
      "preferredAssignments": 0,
      "unfilledRoles": [],
      "infeasible": false
    }
  },
  "assignments": [
    {
      "id": "...",
      "serviceId": "...",
      "serviceTitle": "First Service",
      "serviceStartsAt": "2026-09-05T01:00:00.000Z",
      "roleId": "...",
      "roleName": "Drummer",
      "userId": "...",
      "userDisplayName": "Volunteer",
      "isLocked": false,
      "source": "solver"
    }
  ]
}
```

`coverage` and `fairness` are computed directly from the solver's own
assignment output at generation time (never re-derived or rephrased by an
LLM), satisfying the product rule that no LLM-only reason is treated as
authoritative.

## Locking assignments and regenerating

`PATCH /api/v1/planning-periods/{periodId}/candidates/{candidateId}/assignments/{assignmentId}`
sets `isLocked` on one assignment. Only a `draft` candidate's assignments can
be changed; locking on a `published` or `superseded` candidate returns
`candidate_not_editable` (409). Every change is audited
(`assignment.lock_updated`).

```http
PATCH /api/v1/planning-periods/{periodId}/candidates/{candidateId}/assignments/{assignmentId}
Authorization: Bearer <administrator-firebase-id-token>
Content-Type: application/json

{ "isLocked": true }
```

`POST /api/v1/planning-periods/{periodId}/candidates/{candidateId}/regenerate`
creates a new candidate version: every assignment currently `isLocked` on the
given candidate is carried over unchanged, and the solver only recalculates
the remaining required roles. A locked volunteer is excluded from other
roles in the same service but remains eligible for other services.

If a lock is no longer feasible against current data — the volunteer became
inactive, lost the role capability, became unavailable on the service date,
or the role's required count shrank below the locked count — the endpoint
returns `409 infeasible_lock` with structured detail instead of silently
dropping or overriding the lock, and no new candidate version is created:

```json
{
  "error": {
    "code": "infeasible_lock",
    "message": "One or more locked assignments are no longer feasible",
    "details": {
      "infeasibleLocks": [
        { "serviceId": "...", "roleId": "...", "userId": "...", "reason": "inactive" }
      ]
    }
  }
}
```

`reason` is one of `unqualified`, `inactive`, `unavailable`,
`requirement_exceeded`, or `service_not_found`. The candidate that was
regenerated from is never modified or deleted, so it remains fully
auditable alongside the new version.

## Publishing a roster

`POST /api/v1/planning-periods/{periodId}/candidates/{candidateId}/publish`
publishes a `draft` candidate as the planning period's official roster.
Requires the `roster:publish` permission (administrator only).

In one transaction: any candidate currently `published` for the period is
moved to `superseded`, the target candidate is moved to `published` only if
it is still a `draft` at that moment, and an audit event
(`roster_candidate.published`) is recorded. If either step fails, the whole
transaction rolls back — publication either fully succeeds or leaves the
previous state completely unchanged, so there is never a partial or
duplicate official roster.

Rejected with `409 candidate_not_publishable` if the candidate is not (or is
no longer) a draft, and `409 roster_infeasible` if it does not satisfy every
hard constraint (`hardConstraintsSatisfied: false`). Once published, the
assigned volunteers' `GET /api/v1/me/assignments` immediately reflects the
new roster, since that endpoint only ever reads `published` candidates.

After a successful publish, one email notification is generated per
distinct assigned volunteer (see
[Notification delivery](architecture.md#8-notification-delivery)). Sending
is best-effort and happens after the publish transaction has already
committed: a delivery failure is recorded in `notification_deliveries`
(`status: failed`, `lastError`) but never changes the publish response or
the candidate's status. The publish response body is unaffected by
notification outcomes either way.

## Asking the conversational assistant

`POST /api/v1/assistant/ask` answers a free-text question in English or
Chinese. Any authenticated user may ask about their own assignments
(`assignment:read:self`).

```http
POST /api/v1/assistant/ask
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{ "message": "When do I serve next?" }
```

```json
{
  "intent": "get_my_next_assignment",
  "locale": "en",
  "message": "Your next assignment is Worship Service on 2026-09-05 at 09:00 as Drummer.",
  "assignment": {
    "assignmentId": "...",
    "serviceId": "...",
    "serviceDate": "2026-09-05",
    "serviceTime": "09:00",
    "title": "Worship Service",
    "role": "Drummer"
  }
}
```

The message classifies the request into exactly one allowlisted tool
(`get_my_next_assignment`, `prepare_mark_unavailable`) or a safe
clarification (`unsupported` or `ambiguous`) using structured output from an
LLM call — the model never supplies a user ID; the authenticated user's ID
is always injected by the server before any structured query or write runs.
`assignment` is `null` for clarification replies, prepare replies, or when
the volunteer has no upcoming assignment. `message` is composed server-side
from a fixed English/Chinese template filled with the query result, never
authored freely by the LLM, so every fact in the reply traces back to real
data. If the LLM call itself fails (timeout, rate limit, malformed output),
the endpoint still returns `200` with an `ambiguous` clarification rather
than an error.

## Updating availability through conversation (prepare/confirm)

Read-only questions (`get_my_next_assignment`) execute immediately. Marking
yourself unavailable is a write, so it never happens from `/assistant/ask`
alone — it requires an explicit second call to `/assistant/confirm`.

```http
POST /api/v1/assistant/ask
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{ "message": "I can't serve on September 20" }
```

```json
{
  "intent": "prepare_mark_unavailable",
  "locale": "en",
  "message": "You want to mark yourself unavailable on 2026-09-20. Reply to confirm, or ignore this to cancel.",
  "assignment": null,
  "confirmationToken": "<opaque, signed, short-lived token>",
  "pendingServiceDate": "2026-09-20"
}
```

The LLM resolves any relative date expression ("tomorrow", "next Sunday",
"9月5日") against the current Singapore calendar date and returns an
absolute `YYYY-MM-DD`; if it cannot confidently resolve one specific date,
the reply is instead an `ambiguous` clarification and no token is issued.

Nothing is written yet. The date and action are shown back to the user (per
the `message` and `pendingServiceDate` above) before anything happens.
**The user cancels simply by not confirming** — there is no server-side
state to clean up, since the token is a self-contained, HMAC-signed,
5-minute-lived credential, not a database row.

To execute the write, the same user calls:

```http
POST /api/v1/assistant/confirm
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{ "confirmationToken": "<token from the prepare reply>" }
```

```json
{
  "locale": "en",
  "message": "Done — you're marked unavailable on 2026-09-20.",
  "serviceDate": "2026-09-20"
}
```

`confirm` re-authenticates and re-authorizes the request independently (it
does not trust anything about who was logged in when the token was issued),
and rejects with `403 confirmation_user_mismatch` if the token belongs to a
different user. It then performs the write through the same validated path
as `PUT /api/v1/me/availability`
(`SmartRosterService.setMyAvailability`), which re-checks that the date is
not in the past **at confirmation time** — a token minted for a
same-day-or-future date can still be rejected with `400
past_availability_date` if enough time passed before it was confirmed.
`409 confirmation_expired` covers an invalid, tampered, or expired token
(the same code is used for all three, so a client cannot distinguish
forgery attempts from ordinary expiry).

Representative English and Chinese prompts — including relative-date
expressions like "tomorrow" and "下周日" — are evaluated with
`npm run assistant:eval` (requires `GEMINI_API_KEY`; not part of
`npm test` since it calls the real Gemini API). The provider and free-tier
tradeoffs are recorded in
[ADR 0003](adr/0003-use-gemini-flash-lite-for-assistant-classification.md).
