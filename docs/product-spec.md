# Product Specification

## 1. Product summary

SJSM SmartRoster is an explainable AI-assisted scheduling system for church musicians, production volunteers, ushers, and welcome teams. It helps coordinators produce fair, conflict-free rosters and helps volunteers understand and manage their service commitments.

## 2. Stakeholders and personas

### Volunteer

A musician or service-team member who needs to declare unavailability, see upcoming assignments, request a replacement, and receive notifications.

### Team leader

A leader responsible for one service role or team who needs visibility into eligible and available volunteers, team assignments, and replacement requests.

### Administrator / roster coordinator

The person responsible for defining services, generating candidate rosters, resolving conflicts, publishing the final roster, and communicating changes.

## 3. Problem statement

Manual roster creation is time-consuming and inconsistent because coordinators must reconcile availability, role capabilities, assignment conflicts, service history, fairness, preferences, and special-service requirements. Existing SJSM software stores much of this information but still requires substantial manual assignment work and exposes business logic directly through a client-to-Firestore architecture.

## 4. Goals

- Reduce the time required to produce a two-month roster.
- Generate rosters with zero hard-constraint violations.
- Improve distribution fairness without removing human judgment.
- Explain why a volunteer was or was not assigned.
- Let volunteers query their own commitments using natural language.
- Move privileged business operations behind an authenticated server API.
- Provide reliable email notifications when rosters or assignments change.

## 5. Non-goals for the MVP

- Fully autonomous roster publication.
- Replacing pastoral or ministry-leader judgment.
- Predicting volunteer behavior from sensitive personal data.
- Supporting every ministry or arbitrary organization structure.
- Native iOS or Android applications.
- WhatsApp Business API integration.
- Training or fine-tuning a foundation model.

## 6. Functional requirements

### FR-1 Authentication and authorization

- Existing users authenticate with Firebase Authentication.
- The backend verifies Firebase ID tokens.
- Volunteer, team-leader, and administrator permissions are enforced server-side.

### FR-2 Member capabilities

- An authorized user can maintain a volunteer's primary and secondary service roles.
- Inactive volunteers are excluded from candidate assignments.

### FR-3 Availability

- A volunteer can view and update their own availability.
- An administrator can view availability needed for roster preparation.
- Changes retain an audit timestamp and actor.

### FR-4 Service planning

- An administrator can create a planning period and its services.
- Each service defines required roles and capacity per role.

### FR-5 Candidate roster generation

- An administrator can generate one or more candidate rosters.
- The engine uses hard constraints and weighted soft constraints.
- A failed generation returns actionable reasons rather than silently producing an invalid roster.

### FR-6 Review and regeneration

- An administrator can inspect assignments, scores, conflicts, and explanations.
- An administrator can lock selected assignments and regenerate the remainder.
- Generated candidates remain drafts until explicitly published.

### FR-7 Publication

- Only an authorized administrator can publish a roster.
- Publication is atomic and produces an audit record.
- A published roster can be viewed by affected volunteers.

### FR-8 Conversational assistant

The MVP supports these intents:

- `get_my_next_assignment`
- `get_my_assignments_for_period`
- `get_my_availability`
- `mark_unavailable`

Read-only intents may execute immediately. A write intent must show the interpreted date and action and require confirmation before execution.

### FR-9 Notifications

- A roster publication can send assignment emails.
- An assignment change can notify the affected volunteer.
- Failed deliveries are recorded and can be retried safely.

## 7. Scheduling constraints

### Hard constraints

- Do not assign an unavailable volunteer.
- Do not assign an inactive volunteer.
- Assign only volunteers qualified for the role.
- Satisfy each required role capacity or report it as unfilled.
- Do not assign a volunteer to conflicting roles in the same service.
- Preserve administrator-locked assignments.
- Do not create duplicate assignments.

### Soft constraints

- Balance assignment counts over the planning period and recent history.
- Avoid consecutive-week assignments where alternatives exist.
- Prefer a volunteer's primary role over a secondary role.
- Respect declared preferences where possible.
- Reduce repeated pairing or concentration where configured.
- Minimize changes when regenerating an existing candidate.

Soft-constraint weights must be configurable by an administrator within validated bounds.

## 8. Explainability requirements

For each candidate roster, the system shows:

- hard-constraint status;
- total and per-category soft scores;
- unfilled roles;
- fairness distribution;
- reasons for important assignments or exclusions;
- compromises made because constraints could not all be optimized simultaneously.

Explanations must be grounded in solver inputs and outputs. An LLM may rewrite structured reasons into natural language but must not invent reasons.

## 9. Success metrics

- Median time to prepare a two-month roster.
- Number of hard-constraint violations.
- Number of initially unfilled required roles.
- Assignment-count variance or another documented fairness measure.
- Number of manual changes before publication.
- Percentage of assistant queries resolved correctly.
- Email delivery success rate.
- Coordinator satisfaction after trial use.

## 10. Privacy and safety

- Use synthetic or anonymized data for development and demonstration.
- Do not expose other volunteers' private availability notes to ordinary members.
- Minimize personal data sent to an LLM.
- Do not send entire member records or unrestricted schedules to an LLM.
- Log AI tool names and outcomes without logging prompts containing sensitive data.
- Require authorization independently of the model's requested tool call.
- Require human approval before roster publication.

## 11. MVP acceptance

The MVP is complete when an administrator can create a planning period, import or enter volunteers and availability, generate a valid candidate roster, review its score and explanations, lock and regenerate assignments, publish it, notify assigned volunteers, and when an authenticated volunteer can ask for their next assignment and confirm an unavailability update.

