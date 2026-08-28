import { describe, expect, it } from "vitest";
import {
  defaultRosterGenerationWeights,
  generateRosterCandidate,
  regenerateRosterCandidate,
} from "./roster-generator";
import type { RosterGenerationSource } from "./types";

function generate(source: RosterGenerationSource) {
  return generateRosterCandidate(source, defaultRosterGenerationWeights);
}

describe("generateRosterCandidate", () => {
  it("uses maximum matching instead of stranding a role with one eligible volunteer", () => {
    const result = generate({
      planningPeriodId: "period",
      services: [
        {
          id: "service",
          startsAt: new Date("2026-09-05T01:00:00Z"),
          requirements: [
            { roleId: "drums", requiredCount: 1 },
            { roleId: "keys", requiredCount: 1 },
          ],
        },
      ],
      volunteers: [
        {
          userId: "flexible",
          isActive: true,
          capabilities: [
            { roleId: "drums", proficiency: "primary" },
            { roleId: "keys", proficiency: "primary" },
          ],
          availability: {},
        },
        {
          userId: "drums-only",
          isActive: true,
          capabilities: [{ roleId: "drums", proficiency: "secondary" }],
          availability: {},
        },
      ],
    });

    expect(result.hardConstraintsSatisfied).toBe(true);
    expect(result.unfilledRoles).toEqual([]);
    expect(result.assignments).toEqual(
      expect.arrayContaining([
        { serviceId: "service", roleId: "keys", userId: "flexible" },
        { serviceId: "service", roleId: "drums", userId: "drums-only" },
      ]),
    );
  });

  it("reports required capacity that cannot be filled without violating hard constraints", () => {
    const result = generate({
      planningPeriodId: "period",
      services: [
        {
          id: "service",
          startsAt: new Date("2026-09-05T01:00:00Z"),
          requirements: [{ roleId: "drums", requiredCount: 2 }],
        },
      ],
      volunteers: [
        {
          userId: "inactive",
          isActive: false,
          capabilities: [{ roleId: "drums", proficiency: "primary" }],
          availability: {},
        },
        {
          userId: "away",
          isActive: true,
          capabilities: [{ roleId: "drums", proficiency: "primary" }],
          availability: { "2026-09-05": "unavailable" },
        },
        {
          userId: "available",
          isActive: true,
          capabilities: [{ roleId: "drums", proficiency: "secondary" }],
          availability: {},
        },
      ],
    });

    expect(result.assignments).toEqual([
      { serviceId: "service", roleId: "drums", userId: "available" },
    ]);
    expect(result.hardConstraintsSatisfied).toBe(false);
    expect(result.unfilledRoles).toEqual([
      {
        serviceId: "service",
        roleId: "drums",
        requiredCount: 2,
        assignedCount: 1,
        missingCount: 1,
      },
    ]);
  });

  it("never assigns one volunteer twice in the same service", () => {
    const result = generate({
      planningPeriodId: "period",
      services: [
        {
          id: "service",
          startsAt: new Date("2026-09-05T01:00:00Z"),
          requirements: [
            { roleId: "drums", requiredCount: 1 },
            { roleId: "keys", requiredCount: 1 },
          ],
        },
      ],
      volunteers: [
        {
          userId: "only-volunteer",
          isActive: true,
          capabilities: [
            { roleId: "drums", proficiency: "primary" },
            { roleId: "keys", proficiency: "primary" },
          ],
          availability: {},
        },
      ],
    });

    expect(result.assignments).toHaveLength(1);
    expect(result.unfilledRoles).toHaveLength(1);
  });

  it("balances repeated services when equally qualified alternatives exist", () => {
    const result = generate({
      planningPeriodId: "period",
      services: [
        {
          id: "first",
          startsAt: new Date("2026-09-05T01:00:00Z"),
          requirements: [{ roleId: "drums", requiredCount: 1 }],
        },
        {
          id: "second",
          startsAt: new Date("2026-09-12T01:00:00Z"),
          requirements: [{ roleId: "drums", requiredCount: 1 }],
        },
      ],
      volunteers: ["alpha", "bravo"].map((userId) => ({
        userId,
        isActive: true,
        capabilities: [{ roleId: "drums", proficiency: "primary" as const }],
        availability: {},
      })),
    });

    expect(new Set(result.assignments.map((assignment) => assignment.userId)).size).toBe(2);
  });

  it("reports coverage and fairness measures grounded in the actual assignments", () => {
    const result = generate({
      planningPeriodId: "period",
      services: [
        {
          id: "first",
          startsAt: new Date("2026-09-05T01:00:00Z"),
          requirements: [{ roleId: "drums", requiredCount: 1 }],
        },
        {
          id: "second",
          startsAt: new Date("2026-09-12T01:00:00Z"),
          requirements: [{ roleId: "drums", requiredCount: 2 }],
        },
      ],
      volunteers: [
        {
          userId: "only-drummer",
          isActive: true,
          capabilities: [{ roleId: "drums", proficiency: "primary" }],
          availability: {},
        },
      ],
    });

    expect(result.explanation.coverage).toEqual({
      totalRequired: 3,
      totalAssigned: 2,
      unfilledCount: 1,
      coveragePercentage: 66.7,
    });
    expect(result.explanation.fairness).toEqual({
      assignmentCountsByUser: { "only-drummer": 2 },
      minAssignments: 2,
      maxAssignments: 2,
      meanAssignments: 2,
      spread: 0,
    });
  });
});

describe("regenerateRosterCandidate", () => {
  function regenerate(
    source: RosterGenerationSource,
    lockedAssignments: Parameters<typeof regenerateRosterCandidate>[2],
  ) {
    return regenerateRosterCandidate(source, defaultRosterGenerationWeights, lockedAssignments);
  }

  it("keeps a locked assignment unchanged and recalculates only the remaining capacity", () => {
    const source: RosterGenerationSource = {
      planningPeriodId: "period",
      services: [
        {
          id: "first",
          startsAt: new Date("2026-09-05T01:00:00Z"),
          requirements: [{ roleId: "drums", requiredCount: 2 }],
        },
      ],
      volunteers: [
        {
          userId: "locked-one",
          isActive: true,
          capabilities: [{ roleId: "drums", proficiency: "primary" }],
          availability: {},
        },
        {
          userId: "flexible",
          isActive: true,
          capabilities: [{ roleId: "drums", proficiency: "secondary" }],
          availability: {},
        },
      ],
    };

    const result = regenerate(source, [{ serviceId: "first", roleId: "drums", userId: "locked-one" }]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected regeneration to succeed");
    expect(result.draft.hardConstraintsSatisfied).toBe(true);
    expect(result.draft.assignments).toEqual(
      expect.arrayContaining([
        { serviceId: "first", roleId: "drums", userId: "locked-one", isLocked: true },
        { serviceId: "first", roleId: "drums", userId: "flexible" },
      ]),
    );
    expect(result.draft.configuration).toMatchObject({
      algorithm: "deterministic-bipartite-matching-v1-with-locks",
    });
  });

  it("excludes a locked volunteer from other roles in the same service but not from other services", () => {
    const source: RosterGenerationSource = {
      planningPeriodId: "period",
      services: [
        {
          id: "first",
          startsAt: new Date("2026-09-05T01:00:00Z"),
          requirements: [
            { roleId: "drums", requiredCount: 1 },
            { roleId: "keys", requiredCount: 1 },
          ],
        },
        {
          id: "second",
          startsAt: new Date("2026-09-12T01:00:00Z"),
          requirements: [{ roleId: "drums", requiredCount: 1 }],
        },
      ],
      volunteers: [
        {
          userId: "multi",
          isActive: true,
          capabilities: [
            { roleId: "drums", proficiency: "primary" },
            { roleId: "keys", proficiency: "primary" },
          ],
          availability: {},
        },
      ],
    };

    const result = regenerate(source, [{ serviceId: "first", roleId: "drums", userId: "multi" }]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected regeneration to succeed");
    expect(result.draft.assignments).toEqual(
      expect.arrayContaining([
        { serviceId: "first", roleId: "drums", userId: "multi", isLocked: true },
        { serviceId: "second", roleId: "drums", userId: "multi" },
      ]),
    );
    expect(result.draft.unfilledRoles).toEqual([
      {
        serviceId: "first",
        roleId: "keys",
        requiredCount: 1,
        assignedCount: 0,
        missingCount: 1,
      },
    ]);
  });

  it("reports an infeasible lock when the volunteer is unavailable on the service date", () => {
    const source: RosterGenerationSource = {
      planningPeriodId: "period",
      services: [
        {
          id: "first",
          startsAt: new Date("2026-09-05T01:00:00Z"),
          requirements: [{ roleId: "drums", requiredCount: 1 }],
        },
      ],
      volunteers: [
        {
          userId: "now-away",
          isActive: true,
          capabilities: [{ roleId: "drums", proficiency: "primary" }],
          availability: { "2026-09-05": "unavailable" },
        },
      ],
    };

    const result = regenerate(source, [{ serviceId: "first", roleId: "drums", userId: "now-away" }]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected regeneration to report an infeasible lock");
    expect(result.infeasibleLocks).toEqual([
      { serviceId: "first", roleId: "drums", userId: "now-away", reason: "unavailable" },
    ]);
  });

  it("reports an infeasible lock when the locked count exceeds the current requirement", () => {
    const source: RosterGenerationSource = {
      planningPeriodId: "period",
      services: [
        {
          id: "first",
          startsAt: new Date("2026-09-05T01:00:00Z"),
          requirements: [{ roleId: "drums", requiredCount: 1 }],
        },
      ],
      volunteers: ["alpha", "bravo"].map((userId) => ({
        userId,
        isActive: true,
        capabilities: [{ roleId: "drums", proficiency: "primary" as const }],
        availability: {},
      })),
    };

    const result = regenerate(source, [
      { serviceId: "first", roleId: "drums", userId: "alpha" },
      { serviceId: "first", roleId: "drums", userId: "bravo" },
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected regeneration to report an infeasible lock");
    expect(result.infeasibleLocks).toEqual(
      expect.arrayContaining([
        { serviceId: "first", roleId: "drums", userId: "alpha", reason: "requirement_exceeded" },
        { serviceId: "first", roleId: "drums", userId: "bravo", reason: "requirement_exceeded" },
      ]),
    );
  });
});
