import { describe, expect, it, vi } from "vitest";
import { SmartRosterService } from "@/domain/smart-roster-service";
import type { DomainRepository } from "@/domain/types";
import { AssistantService } from "./assistant-service";
import type { ClassificationResult, IntentClassifier } from "./types";

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

function fakeClassifier(result: ClassificationResult): IntentClassifier {
  return { classify: vi.fn().mockResolvedValue(result) };
}

describe("AssistantService", () => {
  const now = () => new Date("2026-08-27T04:00:00Z");

  it("answers with the volunteer's next assignment from a real structured query", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.listUpcomingAssignments).mockResolvedValue([
      {
        assignmentId: "a1",
        serviceId: "s1",
        startsAt: new Date("2026-09-05T01:00:00Z"),
        title: "Worship",
        role: "Drummer",
      },
    ]);
    const rosterService = new SmartRosterService(repository, now);
    const assistant = new AssistantService(
      fakeClassifier({ intent: "get_my_next_assignment", locale: "en" }),
      rosterService,
    );

    const reply = await assistant.ask("When do I serve next?", { userId: "volunteer-1" });

    expect(reply.intent).toBe("get_my_next_assignment");
    expect(reply.assignment).toMatchObject({
      serviceId: "s1",
      serviceDate: "2026-09-05",
      serviceTime: "09:00",
      title: "Worship",
      role: "Drummer",
    });
    expect(reply.message).toContain("Worship");
    expect(repository.listUpcomingAssignments).toHaveBeenCalledWith("volunteer-1", now(), undefined);
  });

  it("reports no upcoming assignments when there are none", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.listUpcomingAssignments).mockResolvedValue([]);
    const rosterService = new SmartRosterService(repository, now);
    const assistant = new AssistantService(
      fakeClassifier({ intent: "get_my_next_assignment", locale: "en" }),
      rosterService,
    );

    const reply = await assistant.ask("next assignment?", { userId: "volunteer-1" });

    expect(reply.assignment).toBeNull();
    expect(reply.message).toBe("You have no upcoming assignments.");
  });

  it("returns a Chinese clarification for an ambiguous message without querying assignments", async () => {
    const repository = repositoryStub();
    const rosterService = new SmartRosterService(repository, now);
    const assistant = new AssistantService(
      fakeClassifier({ intent: "ambiguous", locale: "zh" }),
      rosterService,
    );

    const reply = await assistant.ask("嗯？", { userId: "volunteer-1" });

    expect(reply.intent).toBe("ambiguous");
    expect(reply.assignment).toBeNull();
    expect(reply.message).toContain("不太确定");
    expect(repository.listUpcomingAssignments).not.toHaveBeenCalled();
  });

  it("returns a safe clarification for an unsupported request without querying assignments", async () => {
    const repository = repositoryStub();
    const rosterService = new SmartRosterService(repository, now);
    const assistant = new AssistantService(
      fakeClassifier({ intent: "unsupported", locale: "en" }),
      rosterService,
    );

    const reply = await assistant.ask("Please publish the roster for me", { userId: "volunteer-1" });

    expect(reply.intent).toBe("unsupported");
    expect(reply.assignment).toBeNull();
    expect(repository.listUpcomingAssignments).not.toHaveBeenCalled();
  });

  it("only ever uses the authenticated actor's id, never one supplied by the classifier", async () => {
    const repository = repositoryStub();
    vi.mocked(repository.listUpcomingAssignments).mockResolvedValue([]);
    const rosterService = new SmartRosterService(repository, now);
    const maliciousClassifier: IntentClassifier = {
      classify: vi
        .fn()
        .mockResolvedValue({ intent: "get_my_next_assignment", locale: "en", userId: "attacker-id" }),
    };
    const assistant = new AssistantService(maliciousClassifier, rosterService);

    await assistant.ask("when do I serve next?", { userId: "real-authenticated-user" });

    expect(repository.listUpcomingAssignments).toHaveBeenCalledWith("real-authenticated-user", now(), undefined);
  });
});
