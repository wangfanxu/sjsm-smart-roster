# Capstone Delivery Plan

## 1. Academic boundary

The pre-existing repositories `wangfanxu/SJSM_Music` and `wangfanxu/SJSM-music-backend` are legacy references. This repository contains the Capstone specification and new implementation.

Before final submission:

- obtain written confirmation that a new system based on an existing personal project is acceptable;
- document which capabilities existed before the Capstone;
- cite any reused code and justify why it was reused;
- use this repository's commit history, issues, pull requests, tests, and deployments as the primary evidence of Capstone work;
- share the final repository with the GitHub account `quantic-grader` (invited as a read-access collaborator);
- maintain the [task board](https://github.com/users/wangfanxu/projects/1) and the [design and testing document](design-and-testing.md) as required Capstone submission components.

## 2. Delivery scope

### MVP

- authenticated and authorized server API;
- relational model for users, roles, services, availability, and assignments;
- planning-period and service management;
- constraint-based candidate roster generation;
- fairness scoring and structured explanations;
- lock and regenerate workflow;
- human-controlled publication;
- volunteer personal-assignment queries;
- confirmed natural-language availability update;
- email on publication or assignment change;
- automated tests and CI/CD;
- accessible deployed application.

### Stretch

- multiple candidate comparison;
- natural-language administrative constraints;
- replacement recommendations;
- scheduled reminders;
- richer roster explanations;
- operational dashboards.

## 3. Sprint plan

### Sprint 1: Foundation and migration boundary

Goal: establish a deployable server-backed application and core domain model.

Deliverables:

- Next.js application skeleton;
- Firebase Authentication verification;
- PostgreSQL schema and migrations;
- role-based authorization;
- anonymized fixtures and legacy migration spike;
- planning-period, service, member-role, and availability APIs;
- CI checks and first deployed increment.

Demo: sign in, create a planning period, define services, and record availability through the new backend.

### Sprint 2: Smart roster generation

Goal: generate, evaluate, modify, and publish a valid roster.

Deliverables:

- hard and soft constraint model;
- candidate generation;
- fairness and coverage scores;
- structured explanations;
- lock and regenerate;
- transactional publication;
- unit, property/invariant, integration, and end-to-end tests.

Demo: generate a two-month roster from synthetic data, inspect trade-offs, lock assignments, regenerate, and publish.

### Sprint 3: Assistant, notifications, and product quality

Goal: make the system usable by volunteers and presentation-ready.

Deliverables:

- supported conversational intents;
- explicit confirmation for availability writes;
- email publication/change notifications;
- assistant evaluation cases;
- accessibility, error handling, observability, and security review;
- final deployment, design/testing document, and presentation evidence.

Demo: ask for the next assignment, confirm an unavailability update, regenerate the impacted draft roster, publish, and observe the notification.

## 4. Initial user stories

### US-01 View my upcoming assignments

As a volunteer, I want to view my upcoming assignments so that I know when and how I am serving.

Acceptance criteria:

- only the authenticated user's personal view is returned;
- results include service date, time, title, and role;
- results are ordered chronologically;
- empty results are clearly explained.

### US-02 Record unavailability

As a volunteer, I want to record dates when I cannot serve so that I am not assigned on those dates.

Acceptance criteria:

- a volunteer can modify only their own availability;
- invalid or past dates follow documented validation rules;
- the change records actor and timestamp;
- roster generation excludes the unavailable volunteer.

### US-03 Generate a candidate roster

As an administrator, I want to generate a candidate roster so that I can reduce manual scheduling effort.

Acceptance criteria:

- all hard constraints are satisfied or the result clearly reports infeasibility;
- required but unfilled roles are visible;
- the generation configuration and score are stored;
- generation never publishes automatically.

### US-04 Review fairness and explanations

As an administrator, I want to understand roster scores and assignment reasons so that I can make an informed decision.

Acceptance criteria:

- fairness and coverage measures are visible;
- each important explanation references structured solver facts;
- no LLM-only reason is treated as authoritative.

### US-05 Lock and regenerate

As an administrator, I want to lock approved assignments and regenerate the rest so that human judgment remains in control.

Acceptance criteria:

- locked assignments do not change;
- remaining assignments are recalculated;
- infeasible locks produce a clear error;
- the previous candidate remains auditable.

### US-06 Publish a roster

As an administrator, I want to publish an approved roster so that volunteers can rely on a single official schedule.

Acceptance criteria:

- only an administrator can publish;
- publication is atomic;
- the action is audited;
- affected volunteers can view the published assignments.

### US-07 Ask for my next assignment

As a volunteer, I want to ask the assistant when I serve next so that I can get an immediate answer in natural language.

Acceptance criteria:

- the answer comes from an authorized structured query;
- the assistant does not accept a user ID supplied by the model;
- unsupported or ambiguous questions produce a safe clarification;
- representative English and Chinese prompts are evaluated.

### US-08 Update availability through conversation

As a volunteer, I want to state an unavailable date conversationally so that updating my availability is easy.

Acceptance criteria:

- the parsed date and action are shown before writing;
- no write occurs without explicit confirmation;
- the user can cancel;
- authorization and validation are rechecked at execution time.

### US-09 Notify assigned volunteers

As an administrator, I want affected volunteers to receive email notifications so that schedule publication and changes are communicated reliably.

Acceptance criteria:

- notifications are generated only after a successful publication or change;
- duplicate retries do not send unintended duplicate messages;
- delivery status is recorded;
- failures do not roll back an already valid published roster.

## 5. Definition of done

A story is done when its acceptance criteria pass, authorization is tested, relevant documentation is updated, CI is green, no secret or real personal data is committed, and the increment is demonstrable in the deployed environment.

