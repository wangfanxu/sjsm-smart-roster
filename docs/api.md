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

The PostgreSQL repository exposes an eligible-member query that requires an active user, a matching role capability, and no `unavailable` record on the service's Singapore calendar date. The future optimizer must use this query or enforce the equivalent invariant when constructing candidates.
