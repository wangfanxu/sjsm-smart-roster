# ADR 0003: Use Gemini 3.1 Flash-Lite (free tier) for assistant intent classification

- Status: Accepted, with a required follow-up before production use
- Date: 2026-08-28
- Decision owners: Capstone author
- Related issue: #7

## Context

`POST /api/v1/assistant/ask` (US-07) classifies a volunteer's free-text
message into one of three allowlisted outcomes (`get_my_next_assignment`,
`unsupported_request`, `clarification_needed`) plus a detected locale
(`en`/`zh`), using structured LLM output. `src/assistant/types.ts` defines
this as a small `IntentClassifier` interface with one method, so the LLM
provider is an implementation detail behind that interface, not something
the rest of the assistant module depends on directly.

The initial implementation used Claude (`claude-opus-5` via
`@anthropic-ai/sdk`). Claude Opus 5 is Anthropic's most capable and most
expensive tier — considerable overkill for a three-way classification task
producing ~256 output tokens.

## Decision

Use **Gemini 3.1 Flash-Lite** (`gemini-3.1-flash-lite`) via `@google/genai`,
called through the **free API tier**, for the Capstone demo.

## Rationale

- Flash-Lite is priced for high-volume, low-latency classification-style
  work; even its paid tier ($0.25 input / $1.50 output per 1M tokens) is
  cheaper than Claude Haiku, and far cheaper than the Opus tier this
  replaced.
- The free tier costs nothing during development and grading, where traffic
  is synthetic, low-volume, and demo-driven.
- `IntentClassifier` already isolated the provider choice to one file
  (`src/assistant/gemini-intent-classifier.ts`, replacing
  `anthropic-intent-classifier.ts`); `AssistantService` and the route handler
  were unchanged by this swap.

## Consequences

### Positive

- Effectively zero cost for Capstone development, demo, and grading traffic.
- Lower latency and cost than the Opus-tier baseline if/when moved to a paid
  tier.
- The provider swap validated that the `IntentClassifier` boundary works as
  intended — a second provider was implemented without touching
  `AssistantService`, `reply-templates.ts`, the route, or any of their
  tests.

### Negative — must be resolved before production

Google's terms for the **free/"Unpaid" Gemini API tier** state that
submitted content is used to improve Google's products, that human
reviewers may read and annotate it, and explicitly instruct: *"Do not
submit sensitive, confidential, or personal information to the Unpaid
Services."* This directly conflicts with this project's own privacy rules
(`docs/product-spec.md` §10, `AGENTS.md`): minimize personal data sent to an
LLM, and never send real member data through a channel that trains on it. A
volunteer's free-text message to the assistant is exactly the kind of
personal content that policy is meant to protect.

The **paid tier** does not have this problem — Google states paid-tier
prompts and responses are not used to improve their products, only retained
temporarily for abuse/legal purposes.

## Revisit when

- moving beyond synthetic/demo data to any real volunteer interacting with
  the assistant — switch `GEMINI_API_KEY` to a paid-tier project (or
  reconsider the provider) before that happens, not after;
- sustained traffic or latency requirements change the cost comparison
  against Claude Haiku or another provider;
- Google's free-tier terms change in a way that removes the training/review
  clause above.
