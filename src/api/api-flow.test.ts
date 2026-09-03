import { readAllMigrationsSql } from "@/db/apply-migrations-for-tests";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { handleAvailabilityGet, handleAvailabilityPut } from "@/app/api/v1/me/availability/route";
import { handleAssistantConfirmPost } from "@/app/api/v1/assistant/confirm/route";
import { handleAssignmentsGet } from "@/app/api/v1/me/assignments/route";
import { handleMePatch } from "@/app/api/v1/me/route";
import { handleMyReplacementRequestsGet } from "@/app/api/v1/me/replacement-requests/route";
import {
  handleReplacementRequestsGet,
  handleReplacementRequestsPost,
} from "@/app/api/v1/replacement-requests/route";
import { handleReplacementEligibleUsersGet } from "@/app/api/v1/replacement-requests/[requestId]/eligible-users/route";
import { handleReplacementApprovePost } from "@/app/api/v1/replacement-requests/[requestId]/approve/route";
import { handleReplacementDeclinePost } from "@/app/api/v1/replacement-requests/[requestId]/decline/route";
import { handleReplacementCancelPost } from "@/app/api/v1/replacement-requests/[requestId]/cancel/route";
import {
  handlePlanningPeriodsPost,
} from "@/app/api/v1/planning-periods/route";
import {
  handlePlanningPeriodDelete,
  handlePlanningPeriodPatch,
} from "@/app/api/v1/planning-periods/[periodId]/route";
import { handleServicesPost } from "@/app/api/v1/planning-periods/[periodId]/services/route";
import {
  handleServiceDelete,
  handleServicePatch,
} from "@/app/api/v1/planning-periods/[periodId]/services/[serviceId]/route";
import {
  handleCandidatesGet,
  handleCandidatesPost,
} from "@/app/api/v1/planning-periods/[periodId]/candidates/route";
import { handleCandidateDetailGet } from "@/app/api/v1/planning-periods/[periodId]/candidates/[candidateId]/route";
import { handleAssignmentPatch } from "@/app/api/v1/planning-periods/[periodId]/candidates/[candidateId]/assignments/[assignmentId]/route";
import { handleEligibleUsersGet } from "@/app/api/v1/planning-periods/[periodId]/candidates/[candidateId]/assignments/[assignmentId]/eligible-users/route";
import { handleCandidateRegeneratePost } from "@/app/api/v1/planning-periods/[periodId]/candidates/[candidateId]/regenerate/route";
import { handleCandidatePublishPost } from "@/app/api/v1/planning-periods/[periodId]/candidates/[candidateId]/publish/route";
import { handleAssistantAskPost } from "@/app/api/v1/assistant/ask/route";
import { AssistantService } from "@/assistant/assistant-service";
import type { ClassificationResult, IntentClassifier } from "@/assistant/types";
import { NotificationService } from "@/notifications/notification-service";
import type { EmailSender } from "@/notifications/types";
import { handleMemberRolesPut } from "@/app/api/v1/users/[userId]/roles/route";
import { handleUsersGet, handleUsersPost } from "@/app/api/v1/users/route";
import { handleRolesPost } from "@/app/api/v1/roles/route";
import { authenticateRequest } from "@/auth/authorize";
import { createUserRepository } from "@/db/user-repository";
import { createDomainRepository } from "@/db/domain-repository";
import * as schema from "@/db/schema";
import { SmartRosterService } from "@/domain/smart-roster-service";
import type { ApiDependencies } from "@/server/api-dependencies";

const adminId = "00000000-0000-4000-a000-000000000001";
const volunteerId = "00000000-0000-4000-a000-000000000002";
const otherUserId = "00000000-0000-4000-a000-000000000003";
const drummerRoleId = "00000000-0000-4000-a000-000000000004";
const periodId = "00000000-0000-4000-a000-000000000005";
const candidateId = "00000000-0000-4000-a000-000000000006";
const firstServiceId = "00000000-0000-4000-a000-000000000007";
const secondServiceId = "00000000-0000-4000-a000-000000000008";

function fakeClassifier(result: ClassificationResult): IntentClassifier {
  return { classify: async () => result };
}

function fakeEmailSender(): EmailSender {
  return { send: vi.fn().mockResolvedValue({ providerMessageId: "fake-message-id" }) };
}

function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("authorization", "Bearer test-token");
  if (options.body) headers.set("content-type", "application/json");
  return new Request(`https://example.test${path}`, { ...options, headers });
}

describe("Sprint 1 protected API flow", () => {
  let pglite: PGlite;
  let database: PgliteDatabase<typeof schema>;

  beforeAll(async () => {
    pglite = await PGlite.create();
    await pglite.exec(await readAllMigrationsSql());
    database = drizzle(pglite, { schema });
    await pglite.exec(`
      INSERT INTO users (id, firebase_uid, email, display_name, system_role) VALUES
        ('${adminId}', 'firebase-admin', 'admin@example.test', 'Admin', 'administrator'),
        ('${volunteerId}', 'firebase-volunteer', 'volunteer@example.test', 'Volunteer', 'volunteer'),
        ('${otherUserId}', 'firebase-other', 'other@example.test', 'Other', 'volunteer');
      INSERT INTO roles (id, slug, name)
      VALUES ('${drummerRoleId}', 'drummer', 'Drummer');
      INSERT INTO user_roles (user_id, role_id, proficiency) VALUES
        ('${volunteerId}', '${drummerRoleId}', 'primary'),
        ('${otherUserId}', '${drummerRoleId}', 'secondary');
      INSERT INTO planning_periods (id, name, starts_on, ends_on, status, created_by)
      VALUES ('${periodId}', 'Autumn', '2026-09-01', '2026-10-31', 'active', '${adminId}');
      INSERT INTO services (id, planning_period_id, title, starts_at) VALUES
        ('${secondServiceId}', '${periodId}', 'Second Service', '2026-09-12T01:00:00Z'),
        ('${firstServiceId}', '${periodId}', 'First Service', '2026-09-05T01:00:00Z');
      INSERT INTO service_role_requirements (service_id, role_id, required_count) VALUES
        ('${firstServiceId}', '${drummerRoleId}', 1),
        ('${secondServiceId}', '${drummerRoleId}', 1);
      INSERT INTO roster_candidates (
        id, planning_period_id, version, status, hard_constraints_satisfied, created_by
      ) VALUES ('${candidateId}', '${periodId}', 1, 'published', true, '${adminId}');
      INSERT INTO assignments (candidate_id, service_id, role_id, user_id) VALUES
        ('${candidateId}', '${secondServiceId}', '${drummerRoleId}', '${volunteerId}'),
        ('${candidateId}', '${firstServiceId}', '${drummerRoleId}', '${volunteerId}');
    `);
  });

  afterAll(async () => {
    await pglite.close();
  });

  function dependencies(
    firebaseUid = "firebase-volunteer",
    classification: ClassificationResult = { intent: "ambiguous", locale: "en" },
    emailSender: EmailSender = fakeEmailSender(),
  ): ApiDependencies {
    const postgresCompatible = database as unknown as PostgresJsDatabase<typeof schema>;
    const repository = createDomainRepository(postgresCompatible);
    const service = new SmartRosterService(repository, () => new Date("2026-08-27T04:00:00Z"));
    return {
      auth: {
        tokenVerifier: { verifyIdToken: async () => ({ uid: firebaseUid, email: null }) },
        userRepository: createUserRepository(postgresCompatible),
      },
      service,
      assistant: new AssistantService(
        fakeClassifier(classification),
        service,
        "test-secret",
        () => new Date("2026-08-27T04:00:00Z"),
      ),
      notifications: new NotificationService(repository, emailSender),
    };
  }

  it("records only the authenticated volunteer's availability and audits the actor", async () => {
    const response = await handleAvailabilityPut(
      request("/api/v1/me/availability", {
        method: "PUT",
        body: JSON.stringify({
          userId: otherUserId,
          serviceDate: "2026-09-12",
          status: "unavailable",
          note: "Away",
        }),
      }),
      dependencies(),
    );

    expect(response.status).toBe(200);
    const availability = await pglite.query<{ user_id: string; updated_by: string }>(`
      SELECT user_id, updated_by FROM availability
    `);
    expect(availability.rows).toEqual([{ user_id: volunteerId, updated_by: volunteerId }]);
    const audit = await pglite.query<{ actor_user_id: string; action: string }>(`
      SELECT actor_user_id, action FROM audit_events
    `);
    expect(audit.rows).toEqual([
      { actor_user_id: volunteerId, action: "availability.upserted" },
    ]);
    const postgresCompatible = database as unknown as PostgresJsDatabase<typeof schema>;
    await expect(
      createDomainRepository(postgresCompatible).listEligibleUsersForServiceRole(
        secondServiceId,
        drummerRoleId,
      ),
    ).resolves.toEqual([
      { userId: otherUserId, displayName: "Other", email: "other@example.test", proficiency: "secondary" },
    ]);
  });

  it("rejects past availability dates", async () => {
    const response = await handleAvailabilityPut(
      request("/api/v1/me/availability", {
        method: "PUT",
        body: JSON.stringify({ serviceDate: "2026-08-26", status: "unavailable" }),
      }),
      dependencies(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "past_availability_date" },
    });
  });

  it("returns only published assignments for the authenticated user in chronological order", async () => {
    const response = await handleAssignmentsGet(
      request("/api/v1/me/assignments"),
      dependencies(),
    );
    const body = (await response.json()) as { assignments: Array<Record<string, string>> };

    expect(response.status).toBe(200);
    expect(body.assignments).toEqual([
      expect.objectContaining({
        title: "First Service",
        role: "Drummer",
        serviceDate: "2026-09-05",
        serviceTime: "09:00",
      }),
      expect.objectContaining({ title: "Second Service", serviceDate: "2026-09-12" }),
    ]);

    const emptyResponse = await handleAssignmentsGet(
      request("/api/v1/me/assignments"),
      dependencies("firebase-other"),
    );
    await expect(emptyResponse.json()).resolves.toMatchObject({
      assignments: [],
      message: "No upcoming assignments found",
    });
  });

  it("allows an administrator to create planning data and member capabilities atomically", async () => {
    const adminDependencies = dependencies("firebase-admin");
    const periodResponse = await handlePlanningPeriodsPost(
      request("/api/v1/planning-periods", {
        method: "POST",
        body: JSON.stringify({
          name: "Winter",
          startsOn: "2026-11-01",
          endsOn: "2026-12-31",
        }),
      }),
      adminDependencies,
    );
    const periodBody = (await periodResponse.json()) as { planningPeriod: { id: string } };
    expect(periodResponse.status).toBe(201);

    const serviceResponse = await handleServicesPost(
      request(`/api/v1/planning-periods/${periodBody.planningPeriod.id}/services`, {
        method: "POST",
        body: JSON.stringify({
          title: "Winter Service",
          startsAt: "2026-11-07T09:00:00+08:00",
          requirements: [{ roleId: drummerRoleId, requiredCount: 1 }],
        }),
      }),
      { params: Promise.resolve({ periodId: periodBody.planningPeriod.id }) },
      adminDependencies,
    );
    expect(serviceResponse.status).toBe(201);

    const rolesResponse = await handleMemberRolesPut(
      request(`/api/v1/users/${volunteerId}/roles`, {
        method: "PUT",
        body: JSON.stringify({
          capabilities: [{ roleId: drummerRoleId, proficiency: "primary" }],
        }),
      }),
      { params: Promise.resolve({ userId: volunteerId }) },
      adminDependencies,
    );
    expect(rolesResponse.status).toBe(200);

    const audit = await pglite.query<{ count: number }>(`
      SELECT count(*)::int AS count
      FROM audit_events
      WHERE actor_user_id = '${adminId}'
    `);
    expect(audit.rows[0].count).toBe(3);
  });

  async function createServiceInFreshPeriod() {
    const adminDependencies = dependencies("firebase-admin");
    const periodResponse = await handlePlanningPeriodsPost(
      request("/api/v1/planning-periods", {
        method: "POST",
        body: JSON.stringify({ name: "Spring", startsOn: "2027-01-01", endsOn: "2027-02-28" }),
      }),
      adminDependencies,
    );
    const { planningPeriod } = (await periodResponse.json()) as { planningPeriod: { id: string } };

    const serviceResponse = await handleServicesPost(
      request(`/api/v1/planning-periods/${planningPeriod.id}/services`, {
        method: "POST",
        body: JSON.stringify({
          title: "Spring Service",
          startsAt: "2027-01-09T09:00:00+08:00",
          requirements: [{ roleId: drummerRoleId, requiredCount: 1 }],
        }),
      }),
      { params: Promise.resolve({ periodId: planningPeriod.id }) },
      adminDependencies,
    );
    const { service } = (await serviceResponse.json()) as { service: { id: string } };
    return { periodId: planningPeriod.id, serviceId: service.id };
  }

  it("edits a service that has no published assignments", async () => {
    const { periodId: freshPeriodId, serviceId } = await createServiceInFreshPeriod();

    const response = await handleServicePatch(
      request(`/api/v1/planning-periods/${freshPeriodId}/services/${serviceId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: "Spring Service (Updated)",
          startsAt: "2027-01-09T15:00:00+08:00",
          requirements: [{ roleId: drummerRoleId, requiredCount: 2 }],
        }),
      }),
      { params: Promise.resolve({ periodId: freshPeriodId, serviceId }) },
      dependencies("firebase-admin"),
    );
    const body = (await response.json()) as {
      service: { id: string; title: string; requirements: Array<{ roleId: string; requiredCount: number }> };
    };

    expect(response.status).toBe(200);
    expect(body.service.title).toBe("Spring Service (Updated)");
    expect(body.service.requirements).toEqual([{ roleId: drummerRoleId, roleName: "Drummer", requiredCount: 2 }]);
  });

  it("deletes a service that has no published assignments", async () => {
    const { periodId: freshPeriodId, serviceId } = await createServiceInFreshPeriod();

    const response = await handleServiceDelete(
      request(`/api/v1/planning-periods/${freshPeriodId}/services/${serviceId}`, { method: "DELETE" }),
      { params: Promise.resolve({ periodId: freshPeriodId, serviceId }) },
      dependencies("firebase-admin"),
    );

    expect(response.status).toBe(200);
    const row = await pglite.query(`SELECT id FROM services WHERE id = '${serviceId}'`);
    expect(row.rows).toHaveLength(0);
  });

  it("rejects editing a service that has assignments on a published roster", async () => {
    const response = await handleServicePatch(
      request(`/api/v1/planning-periods/${periodId}/services/${firstServiceId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: "Should not apply",
          startsAt: "2026-09-05T09:00:00+08:00",
          requirements: [{ roleId: drummerRoleId, requiredCount: 1 }],
        }),
      }),
      { params: Promise.resolve({ periodId, serviceId: firstServiceId }) },
      dependencies("firebase-admin"),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("service_has_published_assignments");
  });

  it("rejects deleting a service that has assignments on a published roster", async () => {
    const response = await handleServiceDelete(
      request(`/api/v1/planning-periods/${periodId}/services/${firstServiceId}`, { method: "DELETE" }),
      { params: Promise.resolve({ periodId, serviceId: firstServiceId }) },
      dependencies("firebase-admin"),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("service_has_published_assignments");
  });

  it("edits a planning period that has no published roster", async () => {
    const { periodId: freshPeriodId } = await createServiceInFreshPeriod();

    const response = await handlePlanningPeriodPatch(
      request(`/api/v1/planning-periods/${freshPeriodId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Spring (Renamed)", startsOn: "2027-01-01", endsOn: "2027-02-28" }),
      }),
      { params: Promise.resolve({ periodId: freshPeriodId }) },
      dependencies("firebase-admin"),
    );
    const body = (await response.json()) as { planningPeriod: { name: string } };

    expect(response.status).toBe(200);
    expect(body.planningPeriod.name).toBe("Spring (Renamed)");
  });

  it("deletes a planning period that has no published roster", async () => {
    const { periodId: freshPeriodId } = await createServiceInFreshPeriod();

    const response = await handlePlanningPeriodDelete(
      request(`/api/v1/planning-periods/${freshPeriodId}`, { method: "DELETE" }),
      { params: Promise.resolve({ periodId: freshPeriodId }) },
      dependencies("firebase-admin"),
    );

    expect(response.status).toBe(200);
    const row = await pglite.query(`SELECT id FROM planning_periods WHERE id = '${freshPeriodId}'`);
    expect(row.rows).toHaveLength(0);
  });

  it("rejects shrinking a planning period's dates to exclude an existing service", async () => {
    const { periodId: freshPeriodId } = await createServiceInFreshPeriod();

    const response = await handlePlanningPeriodPatch(
      request(`/api/v1/planning-periods/${freshPeriodId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Spring", startsOn: "2027-01-10", endsOn: "2027-02-28" }),
      }),
      { params: Promise.resolve({ periodId: freshPeriodId }) },
      dependencies("firebase-admin"),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("period_shrink_excludes_services");
  });

  it("rejects editing a planning period that has a published roster", async () => {
    const response = await handlePlanningPeriodPatch(
      request(`/api/v1/planning-periods/${periodId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Should not apply", startsOn: "2026-09-01", endsOn: "2026-10-31" }),
      }),
      { params: Promise.resolve({ periodId }) },
      dependencies("firebase-admin"),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("period_has_published_roster");
  });

  it("rejects deleting a planning period that has a published roster", async () => {
    const response = await handlePlanningPeriodDelete(
      request(`/api/v1/planning-periods/${periodId}`, { method: "DELETE" }),
      { params: Promise.resolve({ periodId }) },
      dependencies("firebase-admin"),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("period_has_published_roster");
  });

  it("denies planning writes to volunteers", async () => {
    const response = await handlePlanningPeriodsPost(
      request("/api/v1/planning-periods", {
        method: "POST",
        body: JSON.stringify({
          name: "Denied",
          startsOn: "2026-11-01",
          endsOn: "2026-12-31",
        }),
      }),
      dependencies(),
    );

    expect(response.status).toBe(403);
  });

  it("generates and audits a draft candidate without publishing it", async () => {
    const response = await handleCandidatesPost(
      request(`/api/v1/planning-periods/${periodId}/candidates`, {
        method: "POST",
        body: JSON.stringify({
          weights: { primaryRole: 20, preferredAvailability: 8, loadBalance: 3 },
        }),
      }),
      { params: Promise.resolve({ periodId }) },
      dependencies("firebase-admin"),
    );
    const body = (await response.json()) as {
      candidate: { id: string; version: number; status: string; hardConstraintsSatisfied: boolean };
      assignments: Array<{ serviceId: string; userId: string }>;
      unfilledRoles: unknown[];
    };

    expect(response.status).toBe(201);
    expect(body.candidate).toMatchObject({
      version: 2,
      status: "draft",
      hardConstraintsSatisfied: true,
    });
    expect(body.assignments).toHaveLength(2);
    expect(body.unfilledRoles).toEqual([]);
    expect(body.assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ serviceId: firstServiceId, userId: volunteerId }),
        expect.objectContaining({ serviceId: secondServiceId, userId: otherUserId }),
      ]),
    );

    const stored = await pglite.query<{
      status: string;
      action: string;
      actor_user_id: string;
    }>(`
      SELECT candidate.status, audit.action, audit.actor_user_id
      FROM roster_candidates candidate
      JOIN audit_events audit ON audit.entity_id = candidate.id::text
      WHERE candidate.id = '${body.candidate.id}'
    `);
    expect(stored.rows).toEqual([
      {
        status: "draft",
        action: "roster_candidate.generated",
        actor_user_id: adminId,
      },
    ]);
  });

  it("denies candidate generation to volunteers", async () => {
    const response = await handleCandidatesPost(
      request(`/api/v1/planning-periods/${periodId}/candidates`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ periodId }) },
      dependencies(),
    );

    expect(response.status).toBe(403);
  });

  it("lists roster candidates for a planning period newest version first", async () => {
    const response = await handleCandidatesGet(
      request(`/api/v1/planning-periods/${periodId}/candidates`),
      { params: Promise.resolve({ periodId }) },
      dependencies("firebase-admin"),
    );
    const body = (await response.json()) as {
      candidates: Array<{ id: string; version: number; status: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.candidates.map((candidate) => candidate.version)).toEqual([2, 1]);
    expect(body.candidates[1]).toMatchObject({ id: candidateId, status: "published" });
  });

  it("denies listing roster candidates to volunteers", async () => {
    const response = await handleCandidatesGet(
      request(`/api/v1/planning-periods/${periodId}/candidates`),
      { params: Promise.resolve({ periodId }) },
      dependencies(),
    );

    expect(response.status).toBe(403);
  });

  it("reports a structured error when listing candidates for an unknown planning period", async () => {
    const unknownPeriodId = "00000000-0000-4000-a000-000000000099";
    const response = await handleCandidatesGet(
      request(`/api/v1/planning-periods/${unknownPeriodId}/candidates`),
      { params: Promise.resolve({ periodId: unknownPeriodId }) },
      dependencies("firebase-admin"),
    );

    expect(response.status).toBe(404);
  });

  it("returns candidate detail with enriched assignments for review", async () => {
    const response = await handleCandidateDetailGet(
      request(`/api/v1/planning-periods/${periodId}/candidates/${candidateId}`),
      { params: Promise.resolve({ periodId, candidateId }) },
      dependencies("firebase-admin"),
    );
    const body = (await response.json()) as {
      candidate: { id: string; status: string };
      assignments: Array<{
        serviceTitle: string;
        roleName: string;
        userDisplayName: string;
      }>;
    };

    expect(response.status).toBe(200);
    expect(body.candidate).toMatchObject({ id: candidateId, status: "published" });
    expect(body.assignments).toEqual([
      expect.objectContaining({
        serviceTitle: "First Service",
        roleName: "Drummer",
        userDisplayName: "Volunteer",
      }),
      expect.objectContaining({
        serviceTitle: "Second Service",
        roleName: "Drummer",
        userDisplayName: "Volunteer",
      }),
    ]);
  });

  it("returns a not-found error for a candidate id that does not exist", async () => {
    const unknownCandidateId = "00000000-0000-4000-a000-000000000098";
    const response = await handleCandidateDetailGet(
      request(`/api/v1/planning-periods/${periodId}/candidates/${unknownCandidateId}`),
      { params: Promise.resolve({ periodId, candidateId: unknownCandidateId }) },
      dependencies("firebase-admin"),
    );

    expect(response.status).toBe(404);
  });

  it("denies candidate detail review to volunteers", async () => {
    const response = await handleCandidateDetailGet(
      request(`/api/v1/planning-periods/${periodId}/candidates/${candidateId}`),
      { params: Promise.resolve({ periodId, candidateId }) },
      dependencies(),
    );

    expect(response.status).toBe(403);
  });

  it("answers the assistant's next-assignment question from a real structured query", async () => {
    const response = await handleAssistantAskPost(
      request("/api/v1/assistant/ask", {
        method: "POST",
        body: JSON.stringify({ message: "When do I serve next?" }),
      }),
      dependencies("firebase-volunteer", { intent: "get_my_next_assignment", locale: "en" }),
    );
    const body = (await response.json()) as {
      intent: string;
      assignment: { serviceId: string; title: string; role: string } | null;
      message: string;
    };

    expect(response.status).toBe(200);
    expect(body.intent).toBe("get_my_next_assignment");
    expect(body.assignment).toMatchObject({
      serviceId: firstServiceId,
      title: "First Service",
      role: "Drummer",
    });
    expect(body.message).toContain("First Service");
  });

  it("returns a safe clarification without touching assignment data for an ambiguous question", async () => {
    const response = await handleAssistantAskPost(
      request("/api/v1/assistant/ask", {
        method: "POST",
        body: JSON.stringify({ message: "???" }),
      }),
      dependencies("firebase-volunteer", { intent: "ambiguous", locale: "en" }),
    );
    const body = (await response.json()) as { intent: string; assignment: unknown };

    expect(response.status).toBe(200);
    expect(body.intent).toBe("ambiguous");
    expect(body.assignment).toBeNull();
  });

  it("denies an unauthenticated request to ask the assistant", async () => {
    const response = await handleAssistantAskPost(
      new Request("https://example.test/api/v1/assistant/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "When do I serve next?" }),
      }),
      dependencies(),
    );

    expect(response.status).toBe(401);
  });

  it("prepares and confirms a conversational mark-unavailable request end to end", async () => {
    const prepareResponse = await handleAssistantAskPost(
      request("/api/v1/assistant/ask", {
        method: "POST",
        body: JSON.stringify({ message: "I can't serve on September 20" }),
      }),
      dependencies("firebase-volunteer", {
        intent: "prepare_mark_unavailable",
        locale: "en",
        serviceDate: "2026-09-20",
      }),
    );
    const prepareBody = (await prepareResponse.json()) as {
      intent: string;
      confirmationToken: string;
      pendingServiceDate: string;
      message: string;
    };

    expect(prepareResponse.status).toBe(200);
    expect(prepareBody.intent).toBe("prepare_mark_unavailable");
    expect(prepareBody.pendingServiceDate).toBe("2026-09-20");
    expect(prepareBody.message).toContain("2026-09-20");

    const beforeConfirm = await handleAvailabilityGet(
      request("/api/v1/me/availability"),
      dependencies("firebase-volunteer"),
    );
    const beforeBody = (await beforeConfirm.json()) as {
      availability: Array<{ serviceDate: string }>;
    };
    expect(beforeBody.availability.some((entry) => entry.serviceDate === "2026-09-20")).toBe(false);

    const confirmResponse = await handleAssistantConfirmPost(
      request("/api/v1/assistant/confirm", {
        method: "POST",
        body: JSON.stringify({ confirmationToken: prepareBody.confirmationToken }),
      }),
      dependencies("firebase-volunteer"),
    );
    const confirmBody = (await confirmResponse.json()) as { serviceDate: string; message: string };

    expect(confirmResponse.status).toBe(200);
    expect(confirmBody.serviceDate).toBe("2026-09-20");

    const afterConfirm = await handleAvailabilityGet(
      request("/api/v1/me/availability"),
      dependencies("firebase-volunteer"),
    );
    const afterBody = (await afterConfirm.json()) as {
      availability: Array<{ serviceDate: string; status: string }>;
    };
    expect(afterBody.availability).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ serviceDate: "2026-09-20", status: "unavailable" }),
      ]),
    );
  });

  it("never writes availability when the volunteer never confirms (cancel)", async () => {
    await handleAssistantAskPost(
      request("/api/v1/assistant/ask", {
        method: "POST",
        body: JSON.stringify({ message: "我下周三不能服侍" }),
      }),
      dependencies("firebase-volunteer", {
        intent: "prepare_mark_unavailable",
        locale: "zh",
        serviceDate: "2026-09-23",
      }),
    );

    const response = await handleAvailabilityGet(
      request("/api/v1/me/availability"),
      dependencies("firebase-volunteer"),
    );
    const body = (await response.json()) as { availability: Array<{ serviceDate: string }> };

    expect(body.availability.some((entry) => entry.serviceDate === "2026-09-23")).toBe(false);
  });

  it("denies confirming a mark-unavailable request issued to a different volunteer", async () => {
    const prepareResponse = await handleAssistantAskPost(
      request("/api/v1/assistant/ask", {
        method: "POST",
        body: JSON.stringify({ message: "I can't serve on September 21" }),
      }),
      dependencies("firebase-volunteer", {
        intent: "prepare_mark_unavailable",
        locale: "en",
        serviceDate: "2026-09-21",
      }),
    );
    const { confirmationToken } = (await prepareResponse.json()) as { confirmationToken: string };

    const response = await handleAssistantConfirmPost(
      request("/api/v1/assistant/confirm", {
        method: "POST",
        body: JSON.stringify({ confirmationToken }),
      }),
      dependencies("firebase-other"),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("confirmation_user_mismatch");
  });

  it("creates a role definition as an administrator", async () => {
    const response = await handleRolesPost(
      request("/api/v1/roles", {
        method: "POST",
        body: JSON.stringify({ slug: "vocalist", name: "Vocalist" }),
      }),
      dependencies("firebase-admin"),
    );
    const body = (await response.json()) as { role: { id: string; slug: string; name: string } };

    expect(response.status).toBe(201);
    expect(body.role).toEqual(
      expect.objectContaining({ slug: "vocalist", name: "Vocalist", description: null }),
    );
  });

  it("denies creating a role definition to non-administrators", async () => {
    const response = await handleRolesPost(
      request("/api/v1/roles", {
        method: "POST",
        body: JSON.stringify({ slug: "usher", name: "Usher" }),
      }),
      dependencies(),
    );

    expect(response.status).toBe(403);
  });

  it("rejects creating a role definition with a slug that already exists", async () => {
    const response = await handleRolesPost(
      request("/api/v1/roles", {
        method: "POST",
        body: JSON.stringify({ slug: "drummer", name: "Drummer (duplicate)" }),
      }),
      dependencies("firebase-admin"),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("role_slug_already_exists");
  });

  it("pre-provisions a pending user by email as an administrator", async () => {
    const response = await handleUsersPost(
      request("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({
          email: "new-volunteer@example.test",
          displayName: "New Volunteer",
          systemRole: "volunteer",
        }),
      }),
      dependencies("firebase-admin"),
    );
    const body = (await response.json()) as { user: { id: string; email: string } };

    expect(response.status).toBe(201);
    expect(body.user.email).toBe("new-volunteer@example.test");

    const row = await pglite.query<{ firebase_uid: string | null }>(`
      SELECT firebase_uid FROM users WHERE id = '${body.user.id}'
    `);
    expect(row.rows[0].firebase_uid).toBeNull();
  });

  it("denies pre-provisioning a user to non-administrators", async () => {
    const response = await handleUsersPost(
      request("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({
          email: "another-volunteer@example.test",
          displayName: "Another Volunteer",
          systemRole: "volunteer",
        }),
      }),
      dependencies(),
    );

    expect(response.status).toBe(403);
  });

  it("rejects pre-provisioning a user with an email that is already registered", async () => {
    const response = await handleUsersPost(
      request("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({
          email: "volunteer@example.test",
          displayName: "Duplicate",
          systemRole: "volunteer",
        }),
      }),
      dependencies("firebase-admin"),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("email_already_registered");
  });

  it("lists every user with their current role capabilities as an administrator", async () => {
    const response = await handleUsersGet(request("/api/v1/users"), dependencies("firebase-admin"));
    const body = (await response.json()) as {
      users: Array<{
        id: string;
        email: string;
        systemRole: string;
        roles: Array<{ roleId: string; roleName: string; proficiency: string }>;
      }>;
    };

    expect(response.status).toBe(200);
    const volunteer = body.users.find((user) => user.id === volunteerId);
    const other = body.users.find((user) => user.id === otherUserId);
    const admin = body.users.find((user) => user.id === adminId);

    expect(volunteer?.roles).toEqual([
      { roleId: drummerRoleId, roleName: "Drummer", proficiency: "primary" },
    ]);
    expect(other?.roles).toEqual([
      { roleId: drummerRoleId, roleName: "Drummer", proficiency: "secondary" },
    ]);
    expect(admin?.roles).toEqual([]);
  });

  it("denies listing users to non-administrators", async () => {
    const response = await handleUsersGet(request("/api/v1/users"), dependencies());

    expect(response.status).toBe(403);
  });

  it("lets a signed-in member update their own display name", async () => {
    const response = await handleMePatch(
      request("/api/v1/me", { method: "PATCH", body: JSON.stringify({ displayName: "New Name" }) }),
      dependencies(),
    );
    const body = (await response.json()) as { user: { id: string; displayName: string } };

    expect(response.status).toBe(200);
    expect(body.user.displayName).toBe("New Name");

    const row = await pglite.query<{ display_name: string }>(`
      SELECT display_name FROM users WHERE id = '${volunteerId}'
    `);
    expect(row.rows[0].display_name).toBe("New Name");
  });

  it("rejects updating your own display name to an empty value", async () => {
    const response = await handleMePatch(
      request("/api/v1/me", { method: "PATCH", body: JSON.stringify({ displayName: "  " }) }),
      dependencies(),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
  });

  it("lets a member self-manage their own role capabilities", async () => {
    const response = await handleMemberRolesPut(
      request(`/api/v1/users/${volunteerId}/roles`, {
        method: "PUT",
        body: JSON.stringify({ capabilities: [{ roleId: drummerRoleId, proficiency: "secondary" }] }),
      }),
      { params: Promise.resolve({ userId: volunteerId }) },
      dependencies(),
    );

    expect(response.status).toBe(200);

    const row = await pglite.query<{ proficiency: string }>(`
      SELECT proficiency FROM user_roles WHERE user_id = '${volunteerId}' AND role_id = '${drummerRoleId}'
    `);
    expect(row.rows).toEqual([{ proficiency: "secondary" }]);
  });

  it("denies a member from editing another member's role capabilities", async () => {
    const response = await handleMemberRolesPut(
      request(`/api/v1/users/${otherUserId}/roles`, {
        method: "PUT",
        body: JSON.stringify({ capabilities: [{ roleId: drummerRoleId, proficiency: "primary" }] }),
      }),
      { params: Promise.resolve({ userId: otherUserId }) },
      dependencies(),
    );

    expect(response.status).toBe(403);
  });

  it("links a pre-provisioned account on first Google sign-in and applies the assigned role", async () => {
    const postgresCompatible = database as unknown as PostgresJsDatabase<typeof schema>;
    const provisionResponse = await handleUsersPost(
      request("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({
          email: "first-sign-in@example.test",
          displayName: "First Sign In",
          systemRole: "team_leader",
        }),
      }),
      dependencies("firebase-admin"),
    );
    expect(provisionResponse.status).toBe(201);

    const authDependencies = {
      tokenVerifier: {
        verifyIdToken: async () => ({ uid: "google-new-uid", email: "first-sign-in@example.test" }),
      },
      userRepository: createUserRepository(postgresCompatible),
    };

    const principal = await authenticateRequest(
      new Request("https://example.test", { headers: { authorization: "Bearer any-token" } }),
      authDependencies,
    );
    expect(principal).toMatchObject({
      email: "first-sign-in@example.test",
      systemRole: "team_leader",
    });

    const secondSignIn = await authenticateRequest(
      new Request("https://example.test", { headers: { authorization: "Bearer any-token" } }),
      authDependencies,
    );
    expect(secondSignIn.userId).toBe(principal.userId);
  });
});

describe("Sprint 2 lock and regenerate flow", () => {
  const lockPeriodId = "00000000-0000-4000-a000-000000000105";
  const lockDrummerRoleId = "00000000-0000-4000-a000-000000000104";
  const lockVocalistRoleId = "00000000-0000-4000-a000-000000000106";
  const lockFirstServiceId = "00000000-0000-4000-a000-000000000107";
  const lockSecondServiceId = "00000000-0000-4000-a000-000000000108";
  const lockAdminId = "00000000-0000-4000-a000-000000000101";
  const lockVolunteerId = "00000000-0000-4000-a000-000000000102";
  const lockOtherUserId = "00000000-0000-4000-a000-000000000103";

  let pglite: PGlite;
  let database: PgliteDatabase<typeof schema>;

  beforeAll(async () => {
    pglite = await PGlite.create();
    await pglite.exec(await readAllMigrationsSql());
    database = drizzle(pglite, { schema });
    await pglite.exec(`
      INSERT INTO users (id, firebase_uid, email, display_name, system_role) VALUES
        ('${lockAdminId}', 'firebase-lock-admin', 'lock-admin@example.test', 'Lock Admin', 'administrator'),
        ('${lockVolunteerId}', 'firebase-lock-volunteer', 'lock-volunteer@example.test', 'Lock Volunteer', 'volunteer'),
        ('${lockOtherUserId}', 'firebase-lock-other', 'lock-other@example.test', 'Lock Other', 'volunteer');
      INSERT INTO roles (id, slug, name) VALUES
        ('${lockDrummerRoleId}', 'lock-drummer', 'Drummer'),
        ('${lockVocalistRoleId}', 'lock-vocalist', 'Vocalist');
      INSERT INTO user_roles (user_id, role_id, proficiency) VALUES
        ('${lockVolunteerId}', '${lockDrummerRoleId}', 'primary'),
        ('${lockOtherUserId}', '${lockDrummerRoleId}', 'secondary'),
        ('${lockVolunteerId}', '${lockVocalistRoleId}', 'secondary'),
        ('${lockOtherUserId}', '${lockVocalistRoleId}', 'secondary');
      INSERT INTO planning_periods (id, name, starts_on, ends_on, status, created_by)
      VALUES ('${lockPeriodId}', 'Winter', '2026-09-01', '2026-10-31', 'active', '${lockAdminId}');
      INSERT INTO services (id, planning_period_id, title, starts_at) VALUES
        ('${lockFirstServiceId}', '${lockPeriodId}', 'Lock First Service', '2026-09-05T01:00:00Z'),
        ('${lockSecondServiceId}', '${lockPeriodId}', 'Lock Second Service', '2026-09-12T01:00:00Z');
      INSERT INTO service_role_requirements (service_id, role_id, required_count) VALUES
        ('${lockFirstServiceId}', '${lockDrummerRoleId}', 1),
        ('${lockSecondServiceId}', '${lockDrummerRoleId}', 1);
    `);
  });

  afterAll(async () => {
    await pglite.close();
  });

  function dependencies(
    firebaseUid = "firebase-lock-volunteer",
    emailSender: EmailSender = fakeEmailSender(),
  ): ApiDependencies {
    const postgresCompatible = database as unknown as PostgresJsDatabase<typeof schema>;
    const repository = createDomainRepository(postgresCompatible);
    const service = new SmartRosterService(repository, () => new Date("2026-08-27T04:00:00Z"));
    return {
      auth: {
        tokenVerifier: { verifyIdToken: async () => ({ uid: firebaseUid, email: null }) },
        userRepository: createUserRepository(postgresCompatible),
      },
      service,
      assistant: new AssistantService(
        fakeClassifier({ intent: "ambiguous", locale: "en" }),
        service,
        "test-secret",
        () => new Date("2026-08-27T04:00:00Z"),
      ),
      notifications: new NotificationService(repository, emailSender),
    };
  }

  async function generateDraft() {
    const response = await handleCandidatesPost(
      request(`/api/v1/planning-periods/${lockPeriodId}/candidates`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ periodId: lockPeriodId }) },
      dependencies("firebase-lock-admin"),
    );
    return (await response.json()) as {
      candidate: { id: string; version: number; hardConstraintsSatisfied: boolean };
      assignments: Array<{ id: string; serviceId: string; roleId: string; userId: string }>;
    };
  }

  it("locks an assignment on a draft candidate and audits the change", async () => {
    const draft = await generateDraft();
    const [assignmentToLock] = draft.assignments;

    const response = await handleAssignmentPatch(
      request(
        `/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/assignments/${assignmentToLock.id}`,
        { method: "PATCH", body: JSON.stringify({ isLocked: true }) },
      ),
      {
        params: Promise.resolve({
          periodId: lockPeriodId,
          candidateId: draft.candidate.id,
          assignmentId: assignmentToLock.id,
        }),
      },
      dependencies("firebase-lock-admin"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ id: assignmentToLock.id, isLocked: true });

    const audited = await pglite.query<{ action: string }>(`
      SELECT action FROM audit_events
      WHERE entity_id = '${assignmentToLock.id}' AND action = 'assignment.lock_updated'
    `);
    expect(audited.rows).toHaveLength(1);
  });

  it("denies locking an assignment to volunteers", async () => {
    const draft = await generateDraft();
    const [assignmentToLock] = draft.assignments;

    const response = await handleAssignmentPatch(
      request(
        `/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/assignments/${assignmentToLock.id}`,
        { method: "PATCH", body: JSON.stringify({ isLocked: true }) },
      ),
      {
        params: Promise.resolve({
          periodId: lockPeriodId,
          candidateId: draft.candidate.id,
          assignmentId: assignmentToLock.id,
        }),
      },
      dependencies(),
    );

    expect(response.status).toBe(403);
  });

  it("rejects locking an assignment on a candidate that is no longer a draft", async () => {
    const draft = await generateDraft();
    const [assignmentToLock] = draft.assignments;
    await pglite.exec(
      `UPDATE roster_candidates SET status = 'published' WHERE id = '${draft.candidate.id}'`,
    );

    const response = await handleAssignmentPatch(
      request(
        `/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/assignments/${assignmentToLock.id}`,
        { method: "PATCH", body: JSON.stringify({ isLocked: true }) },
      ),
      {
        params: Promise.resolve({
          periodId: lockPeriodId,
          candidateId: draft.candidate.id,
          assignmentId: assignmentToLock.id,
        }),
      },
      dependencies("firebase-lock-admin"),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("candidate_not_editable");
  });

  it("lists eligible volunteers for an assignment's service and role", async () => {
    const draft = await generateDraft();
    const [assignment] = draft.assignments;

    const response = await handleEligibleUsersGet(
      request(
        `/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/assignments/${assignment.id}/eligible-users`,
      ),
      {
        params: Promise.resolve({
          periodId: lockPeriodId,
          candidateId: draft.candidate.id,
          assignmentId: assignment.id,
        }),
      },
      dependencies("firebase-lock-admin"),
    );
    const body = (await response.json()) as {
      eligibleUsers: Array<{ userId: string; displayName: string; email: string; proficiency: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.eligibleUsers.map((user) => user.userId).sort()).toEqual(
      [lockVolunteerId, lockOtherUserId].sort(),
    );
  });

  it("reassigns an assignment to an eligible volunteer, marking it manual and locked", async () => {
    const draft = await generateDraft();
    const [assignment] = draft.assignments;
    const newUserId = assignment.userId === lockVolunteerId ? lockOtherUserId : lockVolunteerId;

    const response = await handleAssignmentPatch(
      request(
        `/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/assignments/${assignment.id}`,
        { method: "PATCH", body: JSON.stringify({ userId: newUserId }) },
      ),
      {
        params: Promise.resolve({
          periodId: lockPeriodId,
          candidateId: draft.candidate.id,
          assignmentId: assignment.id,
        }),
      },
      dependencies("firebase-lock-admin"),
    );
    const body = (await response.json()) as {
      id: string;
      userId: string;
      isLocked: boolean;
      source: string;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({ id: assignment.id, userId: newUserId, isLocked: true, source: "manual" });

    const audited = await pglite.query<{ action: string }>(`
      SELECT action FROM audit_events
      WHERE entity_id = '${assignment.id}' AND action = 'assignment.reassigned'
    `);
    expect(audited.rows).toHaveLength(1);
  });

  it("rejects reassigning to a volunteer who is not eligible for the role", async () => {
    const draft = await generateDraft();
    const [assignment] = draft.assignments;

    const response = await handleAssignmentPatch(
      request(
        `/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/assignments/${assignment.id}`,
        { method: "PATCH", body: JSON.stringify({ userId: lockAdminId }) },
      ),
      {
        params: Promise.resolve({
          periodId: lockPeriodId,
          candidateId: draft.candidate.id,
          assignmentId: assignment.id,
        }),
      },
      dependencies("firebase-lock-admin"),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("ineligible_assignee");
  });

  it("rejects reassigning to a volunteer already filling another role for the same service", async () => {
    const draft = await generateDraft();
    const drummerAssignment = draft.assignments.find(
      (item) => item.serviceId === lockFirstServiceId,
    )!;
    const otherEligibleUserId =
      drummerAssignment.userId === lockVolunteerId ? lockOtherUserId : lockVolunteerId;

    const inserted = await pglite.query<{ id: string }>(`
      INSERT INTO assignments (candidate_id, service_id, role_id, user_id, is_locked, source)
      VALUES (
        '${draft.candidate.id}', '${lockFirstServiceId}', '${lockVocalistRoleId}',
        '${otherEligibleUserId}', false, 'solver'
      )
      RETURNING id
    `);
    const vocalistAssignmentId = inserted.rows[0].id;

    const response = await handleAssignmentPatch(
      request(
        `/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/assignments/${vocalistAssignmentId}`,
        { method: "PATCH", body: JSON.stringify({ userId: drummerAssignment.userId }) },
      ),
      {
        params: Promise.resolve({
          periodId: lockPeriodId,
          candidateId: draft.candidate.id,
          assignmentId: vocalistAssignmentId,
        }),
      },
      dependencies("firebase-lock-admin"),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("assignment_conflict");
  });

  it("rejects reassigning an assignment on a candidate that is no longer a draft", async () => {
    const draft = await generateDraft();
    const [assignment] = draft.assignments;
    const newUserId = assignment.userId === lockVolunteerId ? lockOtherUserId : lockVolunteerId;
    await pglite.exec(`
      UPDATE roster_candidates SET status = 'superseded'
      WHERE planning_period_id = '${lockPeriodId}' AND status = 'published';
      UPDATE roster_candidates SET status = 'published' WHERE id = '${draft.candidate.id}';
    `);

    const response = await handleAssignmentPatch(
      request(
        `/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/assignments/${assignment.id}`,
        { method: "PATCH", body: JSON.stringify({ userId: newUserId }) },
      ),
      {
        params: Promise.resolve({
          periodId: lockPeriodId,
          candidateId: draft.candidate.id,
          assignmentId: assignment.id,
        }),
      },
      dependencies("firebase-lock-admin"),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("candidate_not_editable");
  });

  it("regenerates a candidate keeping the locked assignment and recalculating the rest", async () => {
    const draft = await generateDraft();
    const [assignmentToLock] = draft.assignments;

    await handleAssignmentPatch(
      request(
        `/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/assignments/${assignmentToLock.id}`,
        { method: "PATCH", body: JSON.stringify({ isLocked: true }) },
      ),
      {
        params: Promise.resolve({
          periodId: lockPeriodId,
          candidateId: draft.candidate.id,
          assignmentId: assignmentToLock.id,
        }),
      },
      dependencies("firebase-lock-admin"),
    );

    const response = await handleCandidateRegeneratePost(
      request(`/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/regenerate`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ periodId: lockPeriodId, candidateId: draft.candidate.id }) },
      dependencies("firebase-lock-admin"),
    );
    const body = (await response.json()) as {
      candidate: { id: string; version: number; status: string; hardConstraintsSatisfied: boolean };
      assignments: Array<{ serviceId: string; roleId: string; userId: string; isLocked: boolean }>;
      unfilledRoles: unknown[];
    };

    expect(response.status).toBe(201);
    expect(body.candidate.version).toBe(draft.candidate.version + 1);
    expect(body.candidate.hardConstraintsSatisfied).toBe(true);
    expect(body.unfilledRoles).toEqual([]);
    expect(body.assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serviceId: assignmentToLock.serviceId,
          roleId: assignmentToLock.roleId,
          userId: assignmentToLock.userId,
          isLocked: true,
        }),
      ]),
    );
    expect(body.assignments).toHaveLength(2);
  });

  it("reports a structured infeasible-lock error and does not create a new candidate version", async () => {
    const draft = await generateDraft();
    const [assignmentToLock] = draft.assignments;

    await handleAssignmentPatch(
      request(
        `/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/assignments/${assignmentToLock.id}`,
        { method: "PATCH", body: JSON.stringify({ isLocked: true }) },
      ),
      {
        params: Promise.resolve({
          periodId: lockPeriodId,
          candidateId: draft.candidate.id,
          assignmentId: assignmentToLock.id,
        }),
      },
      dependencies("firebase-lock-admin"),
    );
    await pglite.exec(
      `UPDATE users SET is_active = false WHERE id = '${assignmentToLock.userId}'`,
    );

    const before = await pglite.query<{ count: string }>(
      `SELECT count(*) FROM roster_candidates WHERE planning_period_id = '${lockPeriodId}'`,
    );

    const response = await handleCandidateRegeneratePost(
      request(`/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/regenerate`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ periodId: lockPeriodId, candidateId: draft.candidate.id }) },
      dependencies("firebase-lock-admin"),
    );
    const body = (await response.json()) as {
      error: { code: string; details: { infeasibleLocks: unknown[] } };
    };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("infeasible_lock");
    expect(body.error.details.infeasibleLocks).toEqual([
      {
        serviceId: assignmentToLock.serviceId,
        roleId: assignmentToLock.roleId,
        userId: assignmentToLock.userId,
        reason: "inactive",
      },
    ]);

    const after = await pglite.query<{ count: string }>(
      `SELECT count(*) FROM roster_candidates WHERE planning_period_id = '${lockPeriodId}'`,
    );
    expect(after.rows[0].count).toBe(before.rows[0].count);

    await pglite.exec(
      `UPDATE users SET is_active = true WHERE id = '${assignmentToLock.userId}'`,
    );
  });

  const firebaseUidByUserId: Record<string, string> = {
    [lockVolunteerId]: "firebase-lock-volunteer",
    [lockOtherUserId]: "firebase-lock-other",
  };

  it("publishes a draft candidate atomically, supersedes the previous published one, and lets the assigned volunteer view it", async () => {
    const draftA = await generateDraft();
    const publishA = await handleCandidatePublishPost(
      request(`/api/v1/planning-periods/${lockPeriodId}/candidates/${draftA.candidate.id}/publish`, {
        method: "POST",
      }),
      { params: Promise.resolve({ periodId: lockPeriodId, candidateId: draftA.candidate.id }) },
      dependencies("firebase-lock-admin"),
    );
    expect(publishA.status).toBe(200);

    const draftB = await generateDraft();
    const publishB = await handleCandidatePublishPost(
      request(`/api/v1/planning-periods/${lockPeriodId}/candidates/${draftB.candidate.id}/publish`, {
        method: "POST",
      }),
      { params: Promise.resolve({ periodId: lockPeriodId, candidateId: draftB.candidate.id }) },
      dependencies("firebase-lock-admin"),
    );
    const publishBBody = (await publishB.json()) as { candidate: { id: string; status: string } };

    expect(publishB.status).toBe(200);
    expect(publishBBody.candidate).toMatchObject({ id: draftB.candidate.id, status: "published" });

    const statuses = await pglite.query<{ id: string; status: string }>(`
      SELECT id, status FROM roster_candidates WHERE planning_period_id = '${lockPeriodId}' ORDER BY version
    `);
    expect(statuses.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: draftA.candidate.id, status: "superseded" }),
        expect.objectContaining({ id: draftB.candidate.id, status: "published" }),
      ]),
    );
    expect(statuses.rows.filter((row) => row.status === "published")).toHaveLength(1);

    const audited = await pglite.query<{ action: string }>(`
      SELECT action FROM audit_events
      WHERE entity_id = '${draftB.candidate.id}' AND action = 'roster_candidate.published'
    `);
    expect(audited.rows).toHaveLength(1);

    const [assignmentToView] = draftB.assignments;
    const assignmentsResponse = await handleAssignmentsGet(
      request("/api/v1/me/assignments"),
      dependencies(firebaseUidByUserId[assignmentToView.userId]),
    );
    const assignmentsBody = (await assignmentsResponse.json()) as {
      assignments: Array<{ serviceId: string }>;
    };
    expect(assignmentsBody.assignments).toEqual(
      expect.arrayContaining([expect.objectContaining({ serviceId: assignmentToView.serviceId })]),
    );
  });

  it("includes other published assignees for the same service as teammates", async () => {
    const draft = await generateDraft();
    const drummerAssignment = draft.assignments.find((item) => item.serviceId === lockFirstServiceId)!;
    const vocalistUserId =
      drummerAssignment.userId === lockVolunteerId ? lockOtherUserId : lockVolunteerId;

    await pglite.exec(`
      INSERT INTO assignments (candidate_id, service_id, role_id, user_id, is_locked, source)
      VALUES (
        '${draft.candidate.id}', '${lockFirstServiceId}', '${lockVocalistRoleId}',
        '${vocalistUserId}', false, 'solver'
      )
    `);

    const publishResponse = await handleCandidatePublishPost(
      request(`/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/publish`, {
        method: "POST",
      }),
      { params: Promise.resolve({ periodId: lockPeriodId, candidateId: draft.candidate.id }) },
      dependencies("firebase-lock-admin"),
    );
    expect(publishResponse.status).toBe(200);

    type AssignmentsResponse = {
      assignments: Array<{
        serviceId: string;
        teammates: Array<{ userId: string; displayName: string; role: string }>;
      }>;
    };

    const drummerView = await handleAssignmentsGet(
      request("/api/v1/me/assignments"),
      dependencies(firebaseUidByUserId[drummerAssignment.userId]),
    );
    const drummerBody = (await drummerView.json()) as AssignmentsResponse;
    const drummerOwnAssignment = drummerBody.assignments.find(
      (assignment) => assignment.serviceId === lockFirstServiceId,
    )!;
    expect(drummerOwnAssignment.teammates).toEqual([
      expect.objectContaining({ userId: vocalistUserId, role: "Vocalist" }),
    ]);

    const vocalistView = await handleAssignmentsGet(
      request("/api/v1/me/assignments"),
      dependencies(firebaseUidByUserId[vocalistUserId]),
    );
    const vocalistBody = (await vocalistView.json()) as AssignmentsResponse;
    const vocalistOwnAssignment = vocalistBody.assignments.find(
      (assignment) => assignment.serviceId === lockFirstServiceId,
    )!;
    expect(vocalistOwnAssignment.teammates).toEqual([
      expect.objectContaining({ userId: drummerAssignment.userId, role: "Drummer" }),
    ]);
  });

  async function publishedDraft() {
    const draft = await generateDraft();
    const publishResponse = await handleCandidatePublishPost(
      request(`/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/publish`, {
        method: "POST",
      }),
      { params: Promise.resolve({ periodId: lockPeriodId, candidateId: draft.candidate.id }) },
      dependencies("firebase-lock-admin"),
    );
    expect(publishResponse.status).toBe(200);
    return draft;
  }

  it("lets the assigned volunteer request a replacement for a published assignment", async () => {
    const draft = await publishedDraft();
    const [assignment] = draft.assignments;

    const response = await handleReplacementRequestsPost(
      request("/api/v1/replacement-requests", {
        method: "POST",
        body: JSON.stringify({ assignmentId: assignment.id, reason: "Traveling" }),
      }),
      dependencies(firebaseUidByUserId[assignment.userId]),
    );
    const body = (await response.json()) as {
      replacementRequest: { id: string; status: string; assignmentId: string; reason: string };
    };

    expect(response.status).toBe(201);
    expect(body.replacementRequest).toMatchObject({
      assignmentId: assignment.id,
      status: "open",
      reason: "Traveling",
    });
  });

  it("rejects requesting a replacement for someone else's assignment", async () => {
    const draft = await publishedDraft();
    const [assignment] = draft.assignments;
    const otherUserId = assignment.userId === lockVolunteerId ? lockOtherUserId : lockVolunteerId;

    const response = await handleReplacementRequestsPost(
      request("/api/v1/replacement-requests", {
        method: "POST",
        body: JSON.stringify({ assignmentId: assignment.id }),
      }),
      dependencies(firebaseUidByUserId[otherUserId]),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("not_your_assignment");
  });

  it("rejects requesting a replacement for an assignment that is not yet published", async () => {
    const draft = await generateDraft();
    const [assignment] = draft.assignments;

    const response = await handleReplacementRequestsPost(
      request("/api/v1/replacement-requests", {
        method: "POST",
        body: JSON.stringify({ assignmentId: assignment.id }),
      }),
      dependencies(firebaseUidByUserId[assignment.userId]),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("assignment_not_published");
  });

  it("rejects a duplicate open replacement request for the same assignment", async () => {
    const draft = await publishedDraft();
    const [assignment] = draft.assignments;
    const requesterDependencies = dependencies(firebaseUidByUserId[assignment.userId]);
    const createBody = JSON.stringify({ assignmentId: assignment.id });

    await handleReplacementRequestsPost(
      request("/api/v1/replacement-requests", { method: "POST", body: createBody }),
      requesterDependencies,
    );
    const response = await handleReplacementRequestsPost(
      request("/api/v1/replacement-requests", { method: "POST", body: createBody }),
      requesterDependencies,
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("replacement_request_already_open");
  });

  it("lists the review queue for an administrator and denies volunteers", async () => {
    const draft = await publishedDraft();
    const [assignment] = draft.assignments;
    await handleReplacementRequestsPost(
      request("/api/v1/replacement-requests", {
        method: "POST",
        body: JSON.stringify({ assignmentId: assignment.id }),
      }),
      dependencies(firebaseUidByUserId[assignment.userId]),
    );

    const adminResponse = await handleReplacementRequestsGet(
      request("/api/v1/replacement-requests"),
      dependencies("firebase-lock-admin"),
    );
    const adminBody = (await adminResponse.json()) as {
      replacementRequests: Array<{ assignmentId: string }>;
    };
    expect(adminResponse.status).toBe(200);
    expect(adminBody.replacementRequests).toEqual(
      expect.arrayContaining([expect.objectContaining({ assignmentId: assignment.id })]),
    );

    const volunteerResponse = await handleReplacementRequestsGet(
      request("/api/v1/replacement-requests"),
      dependencies(firebaseUidByUserId[assignment.userId]),
    );
    expect(volunteerResponse.status).toBe(403);
  });

  it("lets the requester see their own replacement requests", async () => {
    const draft = await publishedDraft();
    const [assignment] = draft.assignments;
    await handleReplacementRequestsPost(
      request("/api/v1/replacement-requests", {
        method: "POST",
        body: JSON.stringify({ assignmentId: assignment.id }),
      }),
      dependencies(firebaseUidByUserId[assignment.userId]),
    );

    const response = await handleMyReplacementRequestsGet(
      request("/api/v1/me/replacement-requests"),
      dependencies(firebaseUidByUserId[assignment.userId]),
    );
    const body = (await response.json()) as {
      replacementRequests: Array<{ assignmentId: string; requesterId: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.replacementRequests).toEqual(
      expect.arrayContaining([expect.objectContaining({ assignmentId: assignment.id })]),
    );
    expect(body.replacementRequests.every((entry) => entry.requesterId === assignment.userId)).toBe(true);
  });

  it("lists eligible replacements for a review", async () => {
    const draft = await publishedDraft();
    const [assignment] = draft.assignments;
    const otherUserId = assignment.userId === lockVolunteerId ? lockOtherUserId : lockVolunteerId;
    const createResponse = await handleReplacementRequestsPost(
      request("/api/v1/replacement-requests", {
        method: "POST",
        body: JSON.stringify({ assignmentId: assignment.id }),
      }),
      dependencies(firebaseUidByUserId[assignment.userId]),
    );
    const { replacementRequest } = (await createResponse.json()) as { replacementRequest: { id: string } };

    const response = await handleReplacementEligibleUsersGet(
      request(`/api/v1/replacement-requests/${replacementRequest.id}/eligible-users`),
      { params: Promise.resolve({ requestId: replacementRequest.id }) },
      dependencies("firebase-lock-admin"),
    );
    const body = (await response.json()) as { eligibleUsers: Array<{ userId: string }> };

    expect(response.status).toBe(200);
    expect(body.eligibleUsers.map((user) => user.userId)).toEqual([otherUserId]);
  });

  it("approves a replacement request, reassigns the assignment, and emails both parties", async () => {
    const emailSender = fakeEmailSender();
    const draft = await publishedDraft();
    const [assignment] = draft.assignments;
    const replacementUserId = assignment.userId === lockVolunteerId ? lockOtherUserId : lockVolunteerId;
    const createResponse = await handleReplacementRequestsPost(
      request("/api/v1/replacement-requests", {
        method: "POST",
        body: JSON.stringify({ assignmentId: assignment.id }),
      }),
      dependencies(firebaseUidByUserId[assignment.userId], emailSender),
    );
    const { replacementRequest } = (await createResponse.json()) as { replacementRequest: { id: string } };

    const response = await handleReplacementApprovePost(
      request(`/api/v1/replacement-requests/${replacementRequest.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ replacementUserId }),
      }),
      { params: Promise.resolve({ requestId: replacementRequest.id }) },
      dependencies("firebase-lock-admin", emailSender),
    );
    const body = (await response.json()) as { replacementRequest: { status: string; replacementUserId: string } };

    expect(response.status).toBe(200);
    expect(body.replacementRequest).toMatchObject({ status: "approved", replacementUserId });

    const assignmentRow = await pglite.query<{ user_id: string; source: string }>(`
      SELECT user_id, source FROM assignments WHERE id = '${assignment.id}'
    `);
    expect(assignmentRow.rows[0]).toEqual({ user_id: replacementUserId, source: "manual" });
    expect(emailSender.send).toHaveBeenCalledTimes(2);
  });

  it("rejects approving with a volunteer who is not eligible for the role", async () => {
    const draft = await publishedDraft();
    const [assignment] = draft.assignments;
    const createResponse = await handleReplacementRequestsPost(
      request("/api/v1/replacement-requests", {
        method: "POST",
        body: JSON.stringify({ assignmentId: assignment.id }),
      }),
      dependencies(firebaseUidByUserId[assignment.userId]),
    );
    const { replacementRequest } = (await createResponse.json()) as { replacementRequest: { id: string } };

    const response = await handleReplacementApprovePost(
      request(`/api/v1/replacement-requests/${replacementRequest.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ replacementUserId: lockAdminId }),
      }),
      { params: Promise.resolve({ requestId: replacementRequest.id }) },
      dependencies("firebase-lock-admin"),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("ineligible_assignee");
  });

  it("rejects approving with a volunteer already filling another role for the same service", async () => {
    const draft = await publishedDraft();
    const drummerAssignment = draft.assignments.find((item) => item.serviceId === lockFirstServiceId)!;
    const vocalistUserId =
      drummerAssignment.userId === lockVolunteerId ? lockOtherUserId : lockVolunteerId;

    const inserted = await pglite.query<{ id: string }>(`
      INSERT INTO assignments (candidate_id, service_id, role_id, user_id, is_locked, source)
      VALUES (
        '${draft.candidate.id}', '${lockFirstServiceId}', '${lockVocalistRoleId}',
        '${vocalistUserId}', false, 'solver'
      )
      RETURNING id
    `);
    const vocalistAssignmentId = inserted.rows[0].id;

    const createResponse = await handleReplacementRequestsPost(
      request("/api/v1/replacement-requests", {
        method: "POST",
        body: JSON.stringify({ assignmentId: vocalistAssignmentId }),
      }),
      dependencies(firebaseUidByUserId[vocalistUserId]),
    );
    const { replacementRequest } = (await createResponse.json()) as { replacementRequest: { id: string } };

    const response = await handleReplacementApprovePost(
      request(`/api/v1/replacement-requests/${replacementRequest.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ replacementUserId: drummerAssignment.userId }),
      }),
      { params: Promise.resolve({ requestId: replacementRequest.id }) },
      dependencies("firebase-lock-admin"),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("assignment_conflict");
  });

  it("declines a replacement request and emails only the requester", async () => {
    const emailSender = fakeEmailSender();
    const draft = await publishedDraft();
    const [assignment] = draft.assignments;
    const createResponse = await handleReplacementRequestsPost(
      request("/api/v1/replacement-requests", {
        method: "POST",
        body: JSON.stringify({ assignmentId: assignment.id }),
      }),
      dependencies(firebaseUidByUserId[assignment.userId], emailSender),
    );
    const { replacementRequest } = (await createResponse.json()) as { replacementRequest: { id: string } };

    const response = await handleReplacementDeclinePost(
      request(`/api/v1/replacement-requests/${replacementRequest.id}/decline`, { method: "POST" }),
      { params: Promise.resolve({ requestId: replacementRequest.id }) },
      dependencies("firebase-lock-admin", emailSender),
    );
    const body = (await response.json()) as { replacementRequest: { status: string } };

    expect(response.status).toBe(200);
    expect(body.replacementRequest.status).toBe("declined");
    expect(emailSender.send).toHaveBeenCalledTimes(1);
  });

  it("rejects approving or declining a replacement request that is no longer open", async () => {
    const draft = await publishedDraft();
    const [assignment] = draft.assignments;
    const replacementUserId = assignment.userId === lockVolunteerId ? lockOtherUserId : lockVolunteerId;
    const createResponse = await handleReplacementRequestsPost(
      request("/api/v1/replacement-requests", {
        method: "POST",
        body: JSON.stringify({ assignmentId: assignment.id }),
      }),
      dependencies(firebaseUidByUserId[assignment.userId]),
    );
    const { replacementRequest } = (await createResponse.json()) as { replacementRequest: { id: string } };

    await handleReplacementDeclinePost(
      request(`/api/v1/replacement-requests/${replacementRequest.id}/decline`, { method: "POST" }),
      { params: Promise.resolve({ requestId: replacementRequest.id }) },
      dependencies("firebase-lock-admin"),
    );

    const response = await handleReplacementApprovePost(
      request(`/api/v1/replacement-requests/${replacementRequest.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ replacementUserId }),
      }),
      { params: Promise.resolve({ requestId: replacementRequest.id }) },
      dependencies("firebase-lock-admin"),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("replacement_request_not_open");
  });

  it("lets the requester cancel their own open replacement request", async () => {
    const draft = await publishedDraft();
    const [assignment] = draft.assignments;
    const requesterDependencies = dependencies(firebaseUidByUserId[assignment.userId]);
    const createResponse = await handleReplacementRequestsPost(
      request("/api/v1/replacement-requests", {
        method: "POST",
        body: JSON.stringify({ assignmentId: assignment.id }),
      }),
      requesterDependencies,
    );
    const { replacementRequest } = (await createResponse.json()) as { replacementRequest: { id: string } };

    const response = await handleReplacementCancelPost(
      request(`/api/v1/replacement-requests/${replacementRequest.id}/cancel`, { method: "POST" }),
      { params: Promise.resolve({ requestId: replacementRequest.id }) },
      requesterDependencies,
    );
    const body = (await response.json()) as { replacementRequest: { status: string } };

    expect(response.status).toBe(200);
    expect(body.replacementRequest.status).toBe("cancelled");
  });

  it("rejects cancelling someone else's replacement request", async () => {
    const draft = await publishedDraft();
    const [assignment] = draft.assignments;
    const otherUserId = assignment.userId === lockVolunteerId ? lockOtherUserId : lockVolunteerId;
    const createResponse = await handleReplacementRequestsPost(
      request("/api/v1/replacement-requests", {
        method: "POST",
        body: JSON.stringify({ assignmentId: assignment.id }),
      }),
      dependencies(firebaseUidByUserId[assignment.userId]),
    );
    const { replacementRequest } = (await createResponse.json()) as { replacementRequest: { id: string } };

    const response = await handleReplacementCancelPost(
      request(`/api/v1/replacement-requests/${replacementRequest.id}/cancel`, { method: "POST" }),
      { params: Promise.resolve({ requestId: replacementRequest.id }) },
      dependencies(firebaseUidByUserId[otherUserId]),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("not_your_replacement_request");
  });

  it("surfaces an open replacement request on the assignment, and clears it once cancelled", async () => {
    const draft = await publishedDraft();
    const [assignment] = draft.assignments;
    const requesterDependencies = dependencies(firebaseUidByUserId[assignment.userId]);
    type AssignmentsResponse = {
      assignments: Array<{ assignmentId: string; openReplacementRequestId: string | null }>;
    };

    const beforeResponse = await handleAssignmentsGet(request("/api/v1/me/assignments"), requesterDependencies);
    const beforeBody = (await beforeResponse.json()) as AssignmentsResponse;
    expect(
      beforeBody.assignments.find((entry) => entry.assignmentId === assignment.id)?.openReplacementRequestId,
    ).toBeNull();

    const createResponse = await handleReplacementRequestsPost(
      request("/api/v1/replacement-requests", {
        method: "POST",
        body: JSON.stringify({ assignmentId: assignment.id }),
      }),
      requesterDependencies,
    );
    const { replacementRequest } = (await createResponse.json()) as { replacementRequest: { id: string } };

    const duringResponse = await handleAssignmentsGet(request("/api/v1/me/assignments"), requesterDependencies);
    const duringBody = (await duringResponse.json()) as AssignmentsResponse;
    expect(duringBody.assignments.find((entry) => entry.assignmentId === assignment.id)?.openReplacementRequestId).toBe(
      replacementRequest.id,
    );

    await handleReplacementCancelPost(
      request(`/api/v1/replacement-requests/${replacementRequest.id}/cancel`, { method: "POST" }),
      { params: Promise.resolve({ requestId: replacementRequest.id }) },
      requesterDependencies,
    );

    const afterResponse = await handleAssignmentsGet(request("/api/v1/me/assignments"), requesterDependencies);
    const afterBody = (await afterResponse.json()) as AssignmentsResponse;
    expect(
      afterBody.assignments.find((entry) => entry.assignmentId === assignment.id)?.openReplacementRequestId,
    ).toBeNull();
  });

  it("denies publishing to volunteers", async () => {
    const draft = await generateDraft();
    const response = await handleCandidatePublishPost(
      request(`/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/publish`, {
        method: "POST",
      }),
      { params: Promise.resolve({ periodId: lockPeriodId, candidateId: draft.candidate.id }) },
      dependencies(),
    );

    expect(response.status).toBe(403);
  });

  it("rejects publishing a candidate that is not a draft", async () => {
    const draft = await generateDraft();
    await handleCandidatePublishPost(
      request(`/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/publish`, {
        method: "POST",
      }),
      { params: Promise.resolve({ periodId: lockPeriodId, candidateId: draft.candidate.id }) },
      dependencies("firebase-lock-admin"),
    );

    const response = await handleCandidatePublishPost(
      request(`/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/publish`, {
        method: "POST",
      }),
      { params: Promise.resolve({ periodId: lockPeriodId, candidateId: draft.candidate.id }) },
      dependencies("firebase-lock-admin"),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("candidate_not_publishable");
  });

  it("sends a roster-published notification to each assigned volunteer after publish", async () => {
    const emailSender = fakeEmailSender();
    const draft = await generateDraft();

    const response = await handleCandidatePublishPost(
      request(`/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/publish`, {
        method: "POST",
      }),
      { params: Promise.resolve({ periodId: lockPeriodId, candidateId: draft.candidate.id }) },
      dependencies("firebase-lock-admin", emailSender),
    );
    expect(response.status).toBe(200);

    const distinctUserIds = new Set(draft.assignments.map((assignment) => assignment.userId));
    expect(emailSender.send).toHaveBeenCalledTimes(distinctUserIds.size);

    const rows = await pglite.query<{
      user_id: string;
      status: string;
      idempotency_key: string;
      provider_message_id: string;
    }>(`
      SELECT user_id, status, idempotency_key, provider_message_id FROM notification_deliveries
      WHERE idempotency_key LIKE 'roster_published:${draft.candidate.id}:%'
    `);
    expect(rows.rows).toHaveLength(distinctUserIds.size);
    for (const row of rows.rows) {
      expect(row.status).toBe("sent");
      expect(row.idempotency_key).toBe(`roster_published:${draft.candidate.id}:${row.user_id}`);
      expect(row.provider_message_id).toBe("fake-message-id");
    }
  });

  it("skips sending roster-published notifications when ROSTER_NOTIFICATIONS_ENABLED is false", async () => {
    vi.stubEnv("ROSTER_NOTIFICATIONS_ENABLED", "false");
    try {
      const emailSender = fakeEmailSender();
      const draft = await generateDraft();

      const response = await handleCandidatePublishPost(
        request(`/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/publish`, {
          method: "POST",
        }),
        { params: Promise.resolve({ periodId: lockPeriodId, candidateId: draft.candidate.id }) },
        dependencies("firebase-lock-admin", emailSender),
      );

      expect(response.status).toBe(200);
      expect(emailSender.send).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("does not resend a notification already marked sent when notified again for the same candidate", async () => {
    const emailSender = fakeEmailSender();
    const draft = await generateDraft();
    const deps = dependencies("firebase-lock-admin", emailSender);
    await handleCandidatePublishPost(
      request(`/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/publish`, {
        method: "POST",
      }),
      { params: Promise.resolve({ periodId: lockPeriodId, candidateId: draft.candidate.id }) },
      deps,
    );
    const distinctUserIds = new Set(draft.assignments.map((assignment) => assignment.userId));
    expect(emailSender.send).toHaveBeenCalledTimes(distinctUserIds.size);

    await deps.notifications.notifyRosterPublished(draft.candidate.id);

    expect(emailSender.send).toHaveBeenCalledTimes(distinctUserIds.size);
  });

  it("records a failed notification without affecting the published candidate", async () => {
    const emailSender: EmailSender = { send: vi.fn().mockRejectedValue(new Error("provider outage")) };
    const draft = await generateDraft();

    const response = await handleCandidatePublishPost(
      request(`/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/publish`, {
        method: "POST",
      }),
      { params: Promise.resolve({ periodId: lockPeriodId, candidateId: draft.candidate.id }) },
      dependencies("firebase-lock-admin", emailSender),
    );
    const body = (await response.json()) as { candidate: { status: string } };
    expect(response.status).toBe(200);
    expect(body.candidate.status).toBe("published");

    const candidateStatus = await pglite.query<{ status: string }>(`
      SELECT status FROM roster_candidates WHERE id = '${draft.candidate.id}'
    `);
    expect(candidateStatus.rows[0].status).toBe("published");

    const notificationRows = await pglite.query<{ status: string; last_error: string }>(`
      SELECT status, last_error FROM notification_deliveries
      WHERE idempotency_key LIKE 'roster_published:${draft.candidate.id}:%'
    `);
    expect(notificationRows.rows.length).toBeGreaterThan(0);
    for (const row of notificationRows.rows) {
      expect(row.status).toBe("failed");
      expect(row.last_error).toBe("provider outage");
    }
  });
  it("rejects publishing a candidate that does not satisfy hard constraints", async () => {
    const unfillableRoleId = "00000000-0000-4000-a000-000000000109";
    const unfillableServiceId = "00000000-0000-4000-a000-000000000110";
    await pglite.exec(`
      INSERT INTO roles (id, slug, name) VALUES ('${unfillableRoleId}', 'lock-trumpet', 'Trumpet');
      INSERT INTO services (id, planning_period_id, title, starts_at)
      VALUES ('${unfillableServiceId}', '${lockPeriodId}', 'Unfillable Service', '2026-09-19T01:00:00Z');
      INSERT INTO service_role_requirements (service_id, role_id, required_count)
      VALUES ('${unfillableServiceId}', '${unfillableRoleId}', 1);
    `);

    const draft = await generateDraft();
    expect(draft.candidate.hardConstraintsSatisfied).toBe(false);

    const response = await handleCandidatePublishPost(
      request(`/api/v1/planning-periods/${lockPeriodId}/candidates/${draft.candidate.id}/publish`, {
        method: "POST",
      }),
      { params: Promise.resolve({ periodId: lockPeriodId, candidateId: draft.candidate.id }) },
      dependencies("firebase-lock-admin"),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("roster_infeasible");
  });

});
