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
});
