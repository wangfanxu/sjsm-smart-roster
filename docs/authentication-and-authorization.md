# Authentication and Authorization

SmartRoster retains Firebase Authentication as its identity provider while making PostgreSQL and the Next.js server the authorization authority.

## Request flow

1. The browser signs in with Firebase Authentication and obtains an ID token.
2. It sends the token as `Authorization: Bearer <token>` over HTTPS.
3. The server verifies signature, audience, issuer, expiry, and revocation with Firebase Admin SDK.
4. The verified Firebase UID is used to look up an active application user in PostgreSQL.
5. The user's database `system_role` is evaluated against the permission required by the operation.
6. Domain services receive the authenticated principal injected by the server.

Firebase custom claims, request bodies, query strings, route parameters, and model-generated tool arguments are never accepted as the current application user or as the source of role permissions.

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
