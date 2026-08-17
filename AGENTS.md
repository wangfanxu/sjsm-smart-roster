# Repository instructions

Read `docs/product-spec.md`, `docs/architecture.md`, and `docs/capstone-plan.md` before proposing or implementing changes.

## Product rules

- Treat roster generation as a constraint-optimization problem, not an unconstrained LLM task.
- Hard constraints must never be knowingly violated.
- Soft-constraint trade-offs must be scored and explainable.
- No generated roster is published without an authorized human confirmation.
- Any conversational action that changes data requires explicit user confirmation.
- Never allow an AI tool call to bypass the authenticated user's authorization.
- All user-facing text must support English and Simplified Chinese.

## Engineering rules

- Keep the system deployable after every completed story.
- Add or update automated tests with every behavior change.
- Keep domain logic outside React components and route-handler glue.
- Validate all API inputs at the server boundary.
- Use database transactions for publishing or replacing a roster.
- Do not commit secrets, service-account keys, real member data, or exported production data.
- Use synthetic or anonymized data in tests, demonstrations, fixtures, and documentation.
- Record material architecture decisions in `docs/adr/`.
- Prefer the smallest implementation that satisfies the current acceptance criteria.

## Capstone evidence

- Link implementation work to a user story or technical task.
- Preserve test results, architecture decisions, and deployment evidence.
- Clearly distinguish pre-Capstone functionality from work created in this repository.
- Do not copy code from the legacy repositories without documenting its origin and purpose.

