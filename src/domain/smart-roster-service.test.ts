import { describe, expect, it, vi } from "vitest";
import { SmartRosterService } from "./smart-roster-service";
import type { DomainRepository } from "./types";

function repositoryStub(): DomainRepository {
  return {
    listPlanningPeriods: vi.fn(),
    createPlanningPeriod: vi.fn(),
    updatePlanningPeriod: vi.fn(),
    deletePlanningPeriod: vi.fn(),
    listServices: vi.fn(),
    getPlanningPeriod: vi.fn(),
    createService: vi.fn(),
    updateService: vi.fn(),
    deleteService: vi.fn(),
    listRoles: vi.fn(),
    createRole: vi.fn(),
    createPendingUser: vi.fn(),
    updateDisplayName: vi.fn(),
    listUsersWithRoles: vi.fn(),
    getMemberRoles: vi.fn(),
    replaceMemberRoles: vi.fn(),
    listAvailability: vi.fn(),
    upsertAvailability: vi.fn(),
    listUpcomingAssignments: vi.fn(),
    listServiceTeammates: vi.fn().mockResolvedValue([]),
    listEligibleUsersForServiceRole: vi.fn(),
    getRosterGenerationSource: vi.fn(),
    saveGeneratedCandidate: vi.fn(),
    listRosterCandidates: vi.fn(),
    getRosterCandidateDetail: vi.fn(),
    setAssignmentLock: vi.fn(),
    reassignAssignment: vi.fn(),
    publishRosterCandidate: vi.fn(),
    getOrCreateNotifications: vi.fn(),
    markNotificationSent: vi.fn(),
    markNotificationFailed: vi.fn(),
    createReplacementRequest: vi.fn(),
    listReplacementRequests: vi.fn(),
    listMyReplacementRequests: vi.fn(),
    getReplacementRequestDetail: vi.fn(),
    getEligibleReplacementsForRequest: vi.fn(),
    approveReplacementRequest: vi.fn(),
    declineReplacementRequest: vi.fn(),
    cancelReplacementRequest: vi.fn(),
  };
}

describe("SmartRosterService", () => {
  const now = () => new Date("2026-08-27T04:00:00Z");

  it("rejects past availability using the Singapore calendar date", async () => {
    const repository = repositoryStub();
    const service = new SmartRosterService(repository, now);

    expect(() =>
      service.setMyAvailability("current-user", {
        serviceDate: "2026-08-26",
        status: "unavailable",
      }),
    ).toThrow(expect.objectContaining({ code: "past_availability_date", status: 400 }));
    expect(repository.upsertAvailability).not.toHaveBeenCalled();
  });

  it("always injects the authenticated user as availability subject and actor", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.upsertAvailability).mockResolvedValue({ status: "unavailable" });
    const service = new SmartRosterService(repository, now);
    const input = { serviceDate: "2026-08-28", status: "unavailable" as const };

    await service.setMyAvailability("current-user", input);

    expect(repository.upsertAvailability).toHaveBeenCalledWith(
      "current-user",
      input,
      "current-user",
    );
  });

  it("rejects a service outside its planning period", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.getPlanningPeriod).mockResolvedValue({
      id: "period",
      startsOn: "2026-09-01",
      endsOn: "2026-10-31",
    });
    const service = new SmartRosterService(repository, now);

    await expect(
      service.createService(
        {
          planningPeriodId: "period",
          title: "Out of range",
          startsAt: new Date("2026-11-01T01:00:00Z"),
          requirements: [{ roleId: "role", requiredCount: 1 }],
        },
        { userId: "administrator" },
      ),
    ).rejects.toMatchObject({ code: "service_outside_planning_period", status: 400 });
    expect(repository.createService).not.toHaveBeenCalled();
  });

  it("rejects updating a service to a date outside its planning period", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.getPlanningPeriod).mockResolvedValue({
      id: "period",
      startsOn: "2026-09-01",
      endsOn: "2026-10-31",
    });
    const service = new SmartRosterService(repository, now);

    await expect(
      service.updateService(
        "period",
        "service",
        {
          title: "Out of range",
          startsAt: new Date("2026-11-01T01:00:00Z"),
          requirements: [{ roleId: "role", requiredCount: 1 }],
        },
        { userId: "administrator" },
      ),
    ).rejects.toMatchObject({ code: "service_outside_planning_period", status: 400 });
    expect(repository.updateService).not.toHaveBeenCalled();
  });

  it("formats upcoming assignment dates and times for Singapore", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.listUpcomingAssignments).mockResolvedValue([
      {
        assignmentId: "assignment",
        serviceId: "service",
        startsAt: new Date("2026-09-05T01:00:00Z"),
        title: "Worship",
        role: "Drummer",
        openReplacementRequestId: null,
      },
    ]);
    const service = new SmartRosterService(repository, now);

    await expect(service.listMyUpcomingAssignments("current-user")).resolves.toEqual([
      expect.objectContaining({ serviceDate: "2026-09-05", serviceTime: "09:00" }),
    ]);
  });

  it("stores generated candidates as drafts with the authenticated administrator", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.getRosterGenerationSource).mockResolvedValue({
      planningPeriodId: "period",
      services: [
        {
          id: "service",
          startsAt: new Date("2026-09-05T01:00:00Z"),
          requirements: [{ roleId: "drummer", requiredCount: 1 }],
        },
      ],
      volunteers: [
        {
          userId: "volunteer",
          isActive: true,
          capabilities: [{ roleId: "drummer", proficiency: "primary" }],
          availability: {},
        },
      ],
    });
    vi.mocked(repository.saveGeneratedCandidate).mockResolvedValue({
      candidate: {
        id: "candidate",
        planningPeriodId: "period",
        version: 1,
        status: "draft",
        hardConstraintsSatisfied: true,
        objectiveScore: "1008.0000",
        configuration: {},
        explanation: {},
      },
      assignments: [{ id: "assignment", serviceId: "service", roleId: "drummer", userId: "volunteer" }],
    });
    const service = new SmartRosterService(repository, now);

    const result = await service.generateCandidate(
      "period",
      {},
      { userId: "administrator" },
    );

    expect(result.candidate.status).toBe("draft");
    expect(repository.saveGeneratedCandidate).toHaveBeenCalledWith(
      expect.objectContaining({ hardConstraintsSatisfied: true }),
      "administrator",
    );
  });

  it("rejects listing roster candidates for an unknown planning period", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.getPlanningPeriod).mockResolvedValue(null);
    const service = new SmartRosterService(repository, now);

    await expect(service.listRosterCandidates("missing")).rejects.toMatchObject({
      code: "planning_period_not_found",
      status: 404,
    });
    expect(repository.listRosterCandidates).not.toHaveBeenCalled();
  });

  it("rejects a candidate detail request when the candidate belongs to a different period", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.getRosterCandidateDetail).mockResolvedValue({
      candidate: {
        id: "candidate",
        planningPeriodId: "other-period",
        version: 1,
        status: "draft",
        hardConstraintsSatisfied: true,
        objectiveScore: "1000.0000",
        configuration: {},
        explanation: {},
        generatedAt: new Date("2026-08-27T00:00:00Z"),
      },
      assignments: [],
    });
    const service = new SmartRosterService(repository, now);

    await expect(
      service.getRosterCandidateDetail("period", "candidate"),
    ).rejects.toMatchObject({ code: "roster_candidate_not_found", status: 404 });
  });

  it("rejects locking an assignment on a candidate from a different period", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.getRosterCandidateDetail).mockResolvedValue({
      candidate: {
        id: "candidate",
        planningPeriodId: "other-period",
        version: 1,
        status: "draft",
        hardConstraintsSatisfied: true,
        objectiveScore: "1000.0000",
        configuration: {},
        explanation: {},
        generatedAt: new Date("2026-08-27T00:00:00Z"),
      },
      assignments: [],
    });
    const service = new SmartRosterService(repository, now);

    await expect(
      service.setAssignmentLock("period", "candidate", "assignment", true, { userId: "administrator" }),
    ).rejects.toMatchObject({ code: "roster_candidate_not_found", status: 404 });
    expect(repository.setAssignmentLock).not.toHaveBeenCalled();
  });

  function draftCandidateDetailWithAssignment() {
    return {
      candidate: {
        id: "candidate",
        planningPeriodId: "period",
        version: 1,
        status: "draft" as const,
        hardConstraintsSatisfied: true,
        objectiveScore: "1000.0000",
        configuration: {},
        explanation: {},
        generatedAt: new Date("2026-08-27T00:00:00Z"),
      },
      assignments: [
        {
          id: "assignment",
          serviceId: "service",
          serviceTitle: "Service",
          serviceStartsAt: new Date("2026-09-05T01:00:00Z"),
          roleId: "drummer",
          roleName: "Drummer",
          userId: "volunteer-1",
          userDisplayName: "Volunteer One",
          userEmail: "volunteer-1@example.test",
          isLocked: false,
          source: "solver" as const,
        },
      ],
    };
  }

  it("delegates an isLocked-only assignment update to setAssignmentLock", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.getRosterCandidateDetail).mockResolvedValue(draftCandidateDetailWithAssignment());
    vi.mocked(repository.setAssignmentLock).mockResolvedValue({ id: "assignment", isLocked: true });
    const service = new SmartRosterService(repository, now);

    await expect(
      service.updateAssignment("period", "candidate", "assignment", { isLocked: true }, {
        userId: "administrator",
      }),
    ).resolves.toEqual({ id: "assignment", isLocked: true });
    expect(repository.setAssignmentLock).toHaveBeenCalledWith("candidate", "assignment", true, "administrator");
    expect(repository.reassignAssignment).not.toHaveBeenCalled();
  });

  it("reassigns to an eligible volunteer, defaulting isLocked to true", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.getRosterCandidateDetail).mockResolvedValue(draftCandidateDetailWithAssignment());
    vi.mocked(repository.listEligibleUsersForServiceRole).mockResolvedValue([
      { userId: "volunteer-2", displayName: "Volunteer Two", email: "volunteer-2@example.test", proficiency: "secondary" },
    ]);
    vi.mocked(repository.reassignAssignment).mockResolvedValue({
      id: "assignment",
      userId: "volunteer-2",
      isLocked: true,
      source: "manual",
    });
    const service = new SmartRosterService(repository, now);

    await expect(
      service.updateAssignment("period", "candidate", "assignment", { userId: "volunteer-2" }, {
        userId: "administrator",
      }),
    ).resolves.toEqual({ id: "assignment", userId: "volunteer-2", isLocked: true, source: "manual" });
    expect(repository.reassignAssignment).toHaveBeenCalledWith(
      "candidate",
      "assignment",
      "volunteer-2",
      true,
      "administrator",
    );
  });

  it("rejects reassigning to a volunteer who is not in the eligible list", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.getRosterCandidateDetail).mockResolvedValue(draftCandidateDetailWithAssignment());
    vi.mocked(repository.listEligibleUsersForServiceRole).mockResolvedValue([]);
    const service = new SmartRosterService(repository, now);

    await expect(
      service.updateAssignment("period", "candidate", "assignment", { userId: "attacker" }, {
        userId: "administrator",
      }),
    ).rejects.toMatchObject({ code: "ineligible_assignee", status: 400 });
    expect(repository.reassignAssignment).not.toHaveBeenCalled();
  });

  it("delegates listing eligible assignees for a known assignment", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.getRosterCandidateDetail).mockResolvedValue(draftCandidateDetailWithAssignment());
    vi.mocked(repository.listEligibleUsersForServiceRole).mockResolvedValue([
      { userId: "volunteer-1", displayName: "Volunteer One", email: "volunteer-1@example.test", proficiency: "primary" },
    ]);
    const service = new SmartRosterService(repository, now);

    await expect(
      service.getEligibleAssignees("period", "candidate", "assignment"),
    ).resolves.toEqual([
      { userId: "volunteer-1", displayName: "Volunteer One", email: "volunteer-1@example.test", proficiency: "primary" },
    ]);
    expect(repository.listEligibleUsersForServiceRole).toHaveBeenCalledWith("service", "drummer");
  });

  it("rejects listing eligible assignees for an unknown assignment id", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.getRosterCandidateDetail).mockResolvedValue(draftCandidateDetailWithAssignment());
    const service = new SmartRosterService(repository, now);

    await expect(
      service.getEligibleAssignees("period", "candidate", "missing-assignment"),
    ).rejects.toMatchObject({ code: "assignment_not_found", status: 404 });
  });

  it("reports infeasible locks as a structured error without persisting anything", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.getRosterGenerationSource).mockResolvedValue({
      planningPeriodId: "period",
      services: [
        {
          id: "service",
          startsAt: new Date("2026-09-05T01:00:00Z"),
          requirements: [{ roleId: "drummer", requiredCount: 1 }],
        },
      ],
      volunteers: [
        {
          userId: "volunteer",
          isActive: false,
          capabilities: [{ roleId: "drummer", proficiency: "primary" }],
          availability: {},
        },
      ],
    });
    vi.mocked(repository.getRosterCandidateDetail).mockResolvedValue({
      candidate: {
        id: "candidate",
        planningPeriodId: "period",
        version: 1,
        status: "draft",
        hardConstraintsSatisfied: true,
        objectiveScore: "1000.0000",
        configuration: {},
        explanation: {},
        generatedAt: new Date("2026-08-27T00:00:00Z"),
      },
      assignments: [
        {
          id: "assignment",
          serviceId: "service",
          serviceTitle: "Service",
          serviceStartsAt: new Date("2026-09-05T01:00:00Z"),
          roleId: "drummer",
          roleName: "Drummer",
          userId: "volunteer",
          userDisplayName: "Volunteer",
          userEmail: "volunteer@example.test",
          isLocked: true,
          source: "solver",
        },
      ],
    });
    const service = new SmartRosterService(repository, now);

    await expect(
      service.regenerateCandidate("period", "candidate", {}, { userId: "administrator" }),
    ).rejects.toMatchObject({
      code: "infeasible_lock",
      status: 409,
      details: {
        infeasibleLocks: [
          { serviceId: "service", roleId: "drummer", userId: "volunteer", reason: "inactive" },
        ],
      },
    });
    expect(repository.saveGeneratedCandidate).not.toHaveBeenCalled();
  });

  it("rejects publishing a candidate from a different period", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.getRosterCandidateDetail).mockResolvedValue({
      candidate: {
        id: "candidate",
        planningPeriodId: "other-period",
        version: 1,
        status: "draft",
        hardConstraintsSatisfied: true,
        objectiveScore: "1000.0000",
        configuration: {},
        explanation: {},
        generatedAt: new Date("2026-08-27T00:00:00Z"),
      },
      assignments: [],
    });
    const service = new SmartRosterService(repository, now);

    await expect(
      service.publishCandidate("period", "candidate", { userId: "administrator" }),
    ).rejects.toMatchObject({ code: "roster_candidate_not_found", status: 404 });
    expect(repository.publishRosterCandidate).not.toHaveBeenCalled();
  });

  it("delegates role creation to the repository with the authenticated administrator", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.createRole).mockResolvedValue({
      id: "role-1",
      slug: "drummer",
      name: "Drummer",
      description: null,
    });
    const service = new SmartRosterService(repository, now);

    await expect(
      service.createRole({ slug: "drummer", name: "Drummer" }, { userId: "administrator" }),
    ).resolves.toEqual({ id: "role-1", slug: "drummer", name: "Drummer", description: null });
    expect(repository.createRole).toHaveBeenCalledWith(
      { slug: "drummer", name: "Drummer" },
      "administrator",
    );
  });

  it("delegates a self display-name update using the authenticated actor as both subject and actor", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.updateDisplayName).mockResolvedValue({ id: "volunteer", displayName: "New Name" });
    const service = new SmartRosterService(repository, now);

    await expect(
      service.updateMyProfile("New Name", { userId: "volunteer" }),
    ).resolves.toEqual({ id: "volunteer", displayName: "New Name" });
    expect(repository.updateDisplayName).toHaveBeenCalledWith("volunteer", "New Name", "volunteer");
  });

  it("delegates listing users with their roles to the repository", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.listUsersWithRoles).mockResolvedValue([
      {
        id: "user-1",
        email: "volunteer@example.test",
        displayName: "Volunteer",
        systemRole: "volunteer",
        isActive: true,
        roles: [{ roleId: "drummer", roleName: "Drummer", proficiency: "primary" }],
      },
    ]);
    const service = new SmartRosterService(repository, now);

    await expect(service.listUsers()).resolves.toEqual([
      {
        id: "user-1",
        email: "volunteer@example.test",
        displayName: "Volunteer",
        systemRole: "volunteer",
        isActive: true,
        roles: [{ roleId: "drummer", roleName: "Drummer", proficiency: "primary" }],
      },
    ]);
  });
});
