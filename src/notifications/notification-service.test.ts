import { describe, expect, it, vi } from "vitest";
import type { DomainRepository, NotificationDelivery } from "@/domain/types";
import { NotificationService } from "./notification-service";
import type { EmailSender } from "./types";

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
  };
}

function fakeEmailSender(): EmailSender {
  return { send: vi.fn().mockResolvedValue({ providerMessageId: "provider-id" }) };
}

const candidateDetail = {
  candidate: {
    id: "candidate",
    planningPeriodId: "period",
    version: 1,
    status: "published" as const,
    hardConstraintsSatisfied: true,
    objectiveScore: "1000.0000",
    configuration: {},
    explanation: {},
    generatedAt: new Date("2026-08-27T00:00:00Z"),
  },
  assignments: [
    {
      id: "a1",
      serviceId: "service-1",
      serviceTitle: "First Service",
      serviceStartsAt: new Date("2026-09-05T01:00:00Z"),
      roleId: "drummer",
      roleName: "Drummer",
      userId: "volunteer-1",
      userDisplayName: "Volunteer One",
      userEmail: "volunteer-1@example.test",
      isLocked: false,
      source: "solver" as const,
    },
    {
      id: "a2",
      serviceId: "service-2",
      serviceTitle: "Second Service",
      serviceStartsAt: new Date("2026-09-12T01:00:00Z"),
      roleId: "drummer",
      roleName: "Drummer",
      userId: "volunteer-1",
      userDisplayName: "Volunteer One",
      userEmail: "volunteer-1@example.test",
      isLocked: false,
      source: "solver" as const,
    },
    {
      id: "a3",
      serviceId: "service-1",
      roleId: "keys",
      roleName: "Keyboard",
      serviceTitle: "First Service",
      serviceStartsAt: new Date("2026-09-05T01:00:00Z"),
      userId: "volunteer-2",
      userDisplayName: "Volunteer Two",
      userEmail: "volunteer-2@example.test",
      isLocked: false,
      source: "solver" as const,
    },
  ],
};

describe("NotificationService", () => {
  it("sends one digest email per distinct volunteer, listing every assignment they received", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.getRosterCandidateDetail).mockResolvedValue(candidateDetail);
    vi.mocked(repository.getOrCreateNotifications).mockImplementation(async (entries) =>
      entries.map((entry, index) => ({ ...entry, id: `notification-${index}`, status: "pending" })),
    );
    const emailSender = fakeEmailSender();
    const service = new NotificationService(repository, emailSender);

    await service.notifyRosterPublished("candidate");

    expect(emailSender.send).toHaveBeenCalledTimes(2);
    expect(repository.getOrCreateNotifications).toHaveBeenCalledWith([
      {
        userId: "volunteer-1",
        recipientEmail: "volunteer-1@example.test",
        eventType: "roster_published",
        idempotencyKey: "roster_published:candidate:volunteer-1",
      },
      {
        userId: "volunteer-2",
        recipientEmail: "volunteer-2@example.test",
        eventType: "roster_published",
        idempotencyKey: "roster_published:candidate:volunteer-2",
      },
    ]);

    const volunteerOneMessage = vi
      .mocked(emailSender.send)
      .mock.calls.find(([message]) => message.to === "volunteer-1@example.test")?.[0];
    expect(volunteerOneMessage?.text).toContain("First Service");
    expect(volunteerOneMessage?.text).toContain("Second Service");
  });

  it("marks each notification sent with the provider message id on success", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.getRosterCandidateDetail).mockResolvedValue(candidateDetail);
    vi.mocked(repository.getOrCreateNotifications).mockResolvedValue([
      {
        id: "notification-1",
        userId: "volunteer-1",
        recipientEmail: "volunteer-1@example.test",
        eventType: "roster_published",
        idempotencyKey: "roster_published:candidate:volunteer-1",
        status: "pending",
      },
    ]);
    const emailSender = fakeEmailSender();
    const service = new NotificationService(repository, emailSender);

    await service.notifyRosterPublished("candidate");

    expect(repository.markNotificationSent).toHaveBeenCalledWith("notification-1", "provider-id");
    expect(repository.markNotificationFailed).not.toHaveBeenCalled();
  });

  it("isolates one recipient's send failure from the others and records the error", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.getRosterCandidateDetail).mockResolvedValue(candidateDetail);
    vi.mocked(repository.getOrCreateNotifications).mockImplementation(async (entries) =>
      entries.map((entry, index) => ({ ...entry, id: `notification-${index}`, status: "pending" })),
    );
    const emailSender: EmailSender = {
      send: vi.fn().mockImplementation(async (message) => {
        if (message.to === "volunteer-1@example.test") {
          throw new Error("provider outage");
        }
        return { providerMessageId: "provider-id" };
      }),
    };
    const service = new NotificationService(repository, emailSender);

    await service.notifyRosterPublished("candidate");

    expect(repository.markNotificationFailed).toHaveBeenCalledWith("notification-0", "provider outage");
    expect(repository.markNotificationSent).toHaveBeenCalledWith("notification-1", "provider-id");
  });

  it("does not resend to a volunteer whose notification is already marked sent", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.getRosterCandidateDetail).mockResolvedValue(candidateDetail);
    // Simulates a retried call: getOrCreateNotifications only returns rows not yet sent.
    vi.mocked(repository.getOrCreateNotifications).mockResolvedValue([
      {
        id: "notification-1",
        userId: "volunteer-2",
        recipientEmail: "volunteer-2@example.test",
        eventType: "roster_published",
        idempotencyKey: "roster_published:candidate:volunteer-2",
        status: "pending",
      } satisfies NotificationDelivery,
    ]);
    const emailSender = fakeEmailSender();
    const service = new NotificationService(repository, emailSender);

    await service.notifyRosterPublished("candidate");

    expect(emailSender.send).toHaveBeenCalledTimes(1);
    expect(emailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "volunteer-2@example.test" }),
    );
  });

  it("does nothing when the candidate has no assignments", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.getRosterCandidateDetail).mockResolvedValue({
      ...candidateDetail,
      assignments: [],
    });
    const emailSender = fakeEmailSender();
    const service = new NotificationService(repository, emailSender);

    await service.notifyRosterPublished("candidate");

    expect(repository.getOrCreateNotifications).not.toHaveBeenCalled();
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("does nothing when the candidate cannot be found", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.getRosterCandidateDetail).mockResolvedValue(null);
    const emailSender = fakeEmailSender();
    const service = new NotificationService(repository, emailSender);

    await expect(service.notifyRosterPublished("missing")).resolves.toBeUndefined();
    expect(emailSender.send).not.toHaveBeenCalled();
  });
});
