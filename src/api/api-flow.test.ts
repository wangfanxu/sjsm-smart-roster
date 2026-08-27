import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleAvailabilityPut } from "@/app/api/v1/me/availability/route";
import { handleAssignmentsGet } from "@/app/api/v1/me/assignments/route";
import {
  handlePlanningPeriodsPost,
} from "@/app/api/v1/planning-periods/route";
import { handleServicesPost } from "@/app/api/v1/planning-periods/[periodId]/services/route";
import { handleMemberRolesPut } from "@/app/api/v1/users/[userId]/roles/route";
import { createUserRepository } from "@/db/user-repository";
import { createDomainRepository } from "@/db/domain-repository";
import * as schema from "@/db/schema";
import { SmartRosterService } from "@/domain/smart-roster-service";
import type { ApiDependencies } from "@/server/api-dependencies";

const migrationPath = fileURLToPath(new URL("../../drizzle/0000_icy_sage.sql", import.meta.url));
const adminId = "00000000-0000-4000-a000-000000000001";
const volunteerId = "00000000-0000-4000-a000-000000000002";
const otherUserId = "00000000-0000-4000-a000-000000000003";
const drummerRoleId = "00000000-0000-4000-a000-000000000004";
const periodId = "00000000-0000-4000-a000-000000000005";
const candidateId = "00000000-0000-4000-a000-000000000006";
const firstServiceId = "00000000-0000-4000-a000-000000000007";
const secondServiceId = "00000000-0000-4000-a000-000000000008";

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
    await pglite.exec(await readFile(migrationPath, "utf8"));
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

  function dependencies(firebaseUid = "firebase-volunteer"): ApiDependencies {
    const postgresCompatible = database as unknown as PostgresJsDatabase<typeof schema>;
    return {
      auth: {
        tokenVerifier: { verifyIdToken: async () => ({ uid: firebaseUid }) },
        userRepository: createUserRepository(postgresCompatible),
      },
      service: new SmartRosterService(
        createDomainRepository(postgresCompatible),
        () => new Date("2026-08-27T04:00:00Z"),
      ),
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
    ).resolves.toEqual([{ userId: otherUserId, proficiency: "secondary" }]);
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
});
