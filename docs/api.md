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
| `GET` | `/api/v1/roles` | Authenticated | List service-role definitions |
| `PUT` | `/api/v1/users/{userId}/roles` | Administrator | Replace a member's role capabilities |
| `GET` | `/api/v1/me/availability` | Authenticated self | Read personal availability |
| `PUT` | `/api/v1/me/availability` | Authenticated self | Upsert personal availability |
| `GET` | `/api/v1/me/assignments` | Authenticated self | List personal assignments from published rosters |

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
