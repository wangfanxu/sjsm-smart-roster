# Authentication and Authorization

SmartRoster retains Firebase Authentication as its identity provider while making PostgreSQL and the Next.js server the authorization authority.

## Request flow

1. The browser signs in with Firebase Authentication (Google sign-in) and obtains an ID token.
2. It sends the token as `Authorization: Bearer <token>` over HTTPS.
3. The server verifies signature, audience, issuer, expiry, and revocation with Firebase Admin SDK.
4. The verified Firebase UID is used to look up an active application user in PostgreSQL.
5. If no row matches the UID (first sign-in), the server tries the token's verified email against a **pending** row — one an administrator pre-provisioned with `firebase_uid = NULL` — and links it (§ Account provisioning below).
6. The user's database `system_role` is evaluated against the permission required by the operation.
7. Domain services receive the authenticated principal injected by the server.

Firebase custom claims, request bodies, query strings, route parameters, and model-generated tool arguments are never accepted as the current application user or as the source of role permissions.

## Account provisioning

There is no self-registration. `firebase_uid` on `users` is nullable specifically to support inviting someone before they have ever signed in:

1. An administrator calls `POST /api/v1/users` (`user:manage`) with the volunteer's email, display name, and system role. This inserts a row with `firebase_uid = NULL` — a "pending" account. A duplicate email is rejected with `409 email_already_registered`.
2. The first time that email signs in with Google, `UserRepository.linkPendingUserByEmail` runs a single `UPDATE ... WHERE email = ? AND firebase_uid IS NULL`, atomically claiming the row for that Firebase UID. Every later sign-in matches directly by `firebase_uid`, so the email lookup never runs again for that account.
3. Because the claim requires `firebase_uid IS NULL`, a second Google account cannot ever "steal" an already-linked row — the `WHERE` clause simply matches nothing once the first sign-in has claimed it. A Google account whose email matches no row (pending or linked) is rejected as `403 user_not_registered`, same as any other unregistered identity.

## Roles

| Role | Scope |
| --- | --- |
| Volunteer | Own profile, assignments, availability, and replacement requests |
| Team leader | Volunteer permissions plus team visibility and replacement review |
| Administrator | Team-leader permissions plus users, planning, roster generation/publication, and notifications |

Team-leader permission is only the first authorization gate. Future team APIs must also constrain results to roles or teams led by that user.

## Failure contract

Missing, malformed, expired, revoked, or invalid tokens return `401`. A valid Firebase identity without an active application account, or an authenticated user without the required permission, returns `403`. Verification details and credentials are never returned to clients.

## Credentials

Firebase App Hosting and Cloud Run use Application Default Credentials. Local development may set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account file stored outside the repository. Service-account JSON, private keys, and real ID tokens must never be committed.

`GET /api/v1/me` is the first protected endpoint and returns only the profile resolved from the verified token.
