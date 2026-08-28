import { describe, expect, it, vi } from "vitest";
import { SmartRosterService } from "./smart-roster-service";
import type { DomainRepository } from "./types";

function repositoryStub(): DomainRepository {
  return {
    listPlanningPeriods: vi.fn(),
    createPlanningPeriod: vi.fn(),
    listServices: vi.fn(),
    getPlanningPeriod: vi.fn(),
    createService: vi.fn(),
    listRoles: vi.fn(),
    replaceMemberRoles: vi.fn(),
    listAvailability: vi.fn(),
    upsertAvailability: vi.fn(),
    listUpcomingAssignments: vi.fn(),
    listEligibleUsersForServiceRole: vi.fn(),
    getRosterGenerationSource: vi.fn(),
    saveGeneratedCandidate: vi.fn(),
    listRosterCandidates: vi.fn(),
    getRosterCandidateDetail: vi.fn(),
    setAssignmentLock: vi.fn(),
    publishRosterCandidate: vi.fn(),
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

  it("formats upcoming assignment dates and times for Singapore", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.listUpcomingAssignments).mockResolvedValue([
      {
        assignmentId: "assignment",
        serviceId: "service",
        startsAt: new Date("2026-09-05T01:00:00Z"),
        title: "Worship",
        role: "Drummer",
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
});
