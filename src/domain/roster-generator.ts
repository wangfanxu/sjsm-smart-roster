import type {
  GeneratedAssignment,
  GeneratedCandidateDraft,
  RosterGenerationSource,
  RosterGenerationWeights,
  UnfilledRole,
} from "./types";

const applicationTimeZone = "Asia/Singapore";

export const defaultRosterGenerationWeights: RosterGenerationWeights = {
  primaryRole: 10,
  preferredAvailability: 5,
  loadBalance: 2,
};

export type LockedAssignment = Readonly<{
  serviceId: string;
  roleId: string;
  userId: string;
}>;

export type InfeasibleLockReason =
  | "unqualified"
  | "inactive"
  | "unavailable"
  | "requirement_exceeded"
  | "service_not_found";

export type InfeasibleLock = LockedAssignment & Readonly<{ reason: InfeasibleLockReason }>;

export type RegenerationResult =
  | Readonly<{ ok: true; draft: GeneratedCandidateDraft }>
  | Readonly<{ ok: false; infeasibleLocks: ReadonlyArray<InfeasibleLock> }>;

type Slot = Readonly<{
  id: string;
  serviceId: string;
  roleId: string;
  serviceDate: string;
  slotIndex: number;
}>;

function calendarDateInSingapore(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: applicationTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function capabilityFor(
  source: RosterGenerationSource,
  userId: string,
  roleId: string,
) {
  return source.volunteers
    .find((volunteer) => volunteer.userId === userId)
    ?.capabilities.find((capability) => capability.roleId === roleId);
}

function totalRequiredCount(source: RosterGenerationSource): number {
  return source.services.reduce(
    (total, service) =>
      total + service.requirements.reduce((sum, requirement) => sum + requirement.requiredCount, 0),
    0,
  );
}

function groupLockedAssignments(
  lockedAssignments: ReadonlyArray<LockedAssignment>,
): Map<string, LockedAssignment[]> {
  const byServiceRole = new Map<string, LockedAssignment[]>();
  for (const lock of lockedAssignments) {
    const key = `${lock.serviceId}:${lock.roleId}`;
    const group = byServiceRole.get(key) ?? [];
    group.push(lock);
    byServiceRole.set(key, group);
  }
  return byServiceRole;
}

function findInfeasibleLocks(
  source: RosterGenerationSource,
  lockedAssignments: ReadonlyArray<LockedAssignment>,
): InfeasibleLock[] {
  const servicesById = new Map(source.services.map((service) => [service.id, service]));
  const volunteersById = new Map(source.volunteers.map((volunteer) => [volunteer.userId, volunteer]));
  const infeasibleByKey = new Map<string, InfeasibleLock>();
  const markInfeasible = (lock: LockedAssignment, reason: InfeasibleLockReason) => {
    const key = `${lock.serviceId}:${lock.roleId}:${lock.userId}`;
    if (!infeasibleByKey.has(key)) infeasibleByKey.set(key, { ...lock, reason });
  };

  for (const lock of lockedAssignments) {
    const service = servicesById.get(lock.serviceId);
    if (!service) {
      markInfeasible(lock, "service_not_found");
      continue;
    }
    const volunteer = volunteersById.get(lock.userId);
    const capability = volunteer?.capabilities.find((entry) => entry.roleId === lock.roleId);
    if (!volunteer || !capability) {
      markInfeasible(lock, "unqualified");
      continue;
    }
    if (!volunteer.isActive) {
      markInfeasible(lock, "inactive");
      continue;
    }
    const serviceDate = calendarDateInSingapore(service.startsAt);
    if (volunteer.availability[serviceDate] === "unavailable") {
      markInfeasible(lock, "unavailable");
    }
  }

  const requirementByServiceRole = new Map<string, number>();
  for (const service of source.services) {
    for (const requirement of service.requirements) {
      requirementByServiceRole.set(`${service.id}:${requirement.roleId}`, requirement.requiredCount);
    }
  }
  for (const [key, group] of groupLockedAssignments(lockedAssignments)) {
    const required = requirementByServiceRole.get(key) ?? 0;
    if (group.length > required) {
      for (const lock of group) markInfeasible(lock, "requirement_exceeded");
    }
  }

  return [...infeasibleByKey.values()];
}

type MatchResult = Readonly<{
  assignments: GeneratedAssignment[];
  unfilledRoles: UnfilledRole[];
  assignmentCounts: Map<string, number>;
  primaryAssignments: number;
  preferredAssignments: number;
}>;

function matchAssignments(
  source: RosterGenerationSource,
  weights: RosterGenerationWeights,
  lockedAssignments: ReadonlyArray<LockedAssignment>,
): MatchResult {
  const volunteersById = new Map(
    source.volunteers.map((volunteer) => [volunteer.userId, volunteer]),
  );
  const assignmentCounts = new Map<string, number>();
  const assignments: GeneratedAssignment[] = [];
  const unfilledRoles: UnfilledRole[] = [];
  let primaryAssignments = 0;
  let preferredAssignments = 0;

  const lockedByServiceRole = groupLockedAssignments(lockedAssignments);

  const orderedServices = [...source.services].sort(
    (left, right) => left.startsAt.getTime() - right.startsAt.getTime() || left.id.localeCompare(right.id),
  );

  for (const service of orderedServices) {
    const serviceDate = calendarDateInSingapore(service.startsAt);
    const lockedUserIds = new Set(
      lockedAssignments.filter((lock) => lock.serviceId === service.id).map((lock) => lock.userId),
    );

    for (const lock of lockedAssignments) {
      if (lock.serviceId !== service.id) continue;
      assignments.push({ serviceId: service.id, roleId: lock.roleId, userId: lock.userId, isLocked: true });
      assignmentCounts.set(lock.userId, (assignmentCounts.get(lock.userId) ?? 0) + 1);
      if (capabilityFor(source, lock.userId, lock.roleId)?.proficiency === "primary") {
        primaryAssignments += 1;
      }
      if (volunteersById.get(lock.userId)?.availability[serviceDate] === "preferred") {
        preferredAssignments += 1;
      }
    }

    const slots = service.requirements.flatMap((requirement) => {
      const lockedCount = lockedByServiceRole.get(`${service.id}:${requirement.roleId}`)?.length ?? 0;
      const remainingCount = Math.max(0, requirement.requiredCount - lockedCount);
      return Array.from({ length: remainingCount }, (_, slotIndex): Slot => ({
        id: `${service.id}:${requirement.roleId}:${slotIndex}`,
        serviceId: service.id,
        roleId: requirement.roleId,
        serviceDate,
        slotIndex,
      }));
    });

    const eligibleUsersBySlot = new Map<string, string[]>();
    for (const slot of slots) {
      const eligible = source.volunteers
        .filter(
          (volunteer) =>
            volunteer.isActive &&
            !lockedUserIds.has(volunteer.userId) &&
            volunteer.availability[serviceDate] !== "unavailable" &&
            volunteer.capabilities.some((capability) => capability.roleId === slot.roleId),
        )
        .sort((left, right) => {
          const leftCapability = left.capabilities.find(
            (capability) => capability.roleId === slot.roleId,
          );
          const rightCapability = right.capabilities.find(
            (capability) => capability.roleId === slot.roleId,
          );
          const rank = (userId: string, primary: boolean, preferred: boolean) =>
            (assignmentCounts.get(userId) ?? 0) * weights.loadBalance -
            (primary ? weights.primaryRole : 0) -
            (preferred ? weights.preferredAvailability : 0);
          const leftRank = rank(
            left.userId,
            leftCapability?.proficiency === "primary",
            left.availability[serviceDate] === "preferred",
          );
          const rightRank = rank(
            right.userId,
            rightCapability?.proficiency === "primary",
            right.availability[serviceDate] === "preferred",
          );
          return leftRank - rightRank || left.userId.localeCompare(right.userId);
        })
        .map((volunteer) => volunteer.userId);
      eligibleUsersBySlot.set(slot.id, eligible);
    }

    const slotsById = new Map(slots.map((slot) => [slot.id, slot]));
    const assignedSlotByUser = new Map<string, string>();
    const tryAssign = (slotId: string, visitedUsers: Set<string>): boolean => {
      for (const userId of eligibleUsersBySlot.get(slotId) ?? []) {
        if (visitedUsers.has(userId)) continue;
        visitedUsers.add(userId);
        const previousSlotId = assignedSlotByUser.get(userId);
        if (!previousSlotId || tryAssign(previousSlotId, visitedUsers)) {
          assignedSlotByUser.set(userId, slotId);
          return true;
        }
      }
      return false;
    };

    const constrainedFirst = [...slots].sort((left, right) => {
      const candidateDifference =
        (eligibleUsersBySlot.get(left.id)?.length ?? 0) -
        (eligibleUsersBySlot.get(right.id)?.length ?? 0);
      return (
        candidateDifference ||
        left.roleId.localeCompare(right.roleId) ||
        left.slotIndex - right.slotIndex
      );
    });
    for (const slot of constrainedFirst) tryAssign(slot.id, new Set());

    const serviceAssignments = [...assignedSlotByUser.entries()]
      .map(([userId, slotId]) => ({ userId, slot: slotsById.get(slotId)! }))
      .sort(
        (left, right) =>
          left.slot.roleId.localeCompare(right.slot.roleId) ||
          left.slot.slotIndex - right.slot.slotIndex ||
          left.userId.localeCompare(right.userId),
      );
    for (const { userId, slot } of serviceAssignments) {
      assignments.push({ serviceId: service.id, roleId: slot.roleId, userId });
      assignmentCounts.set(userId, (assignmentCounts.get(userId) ?? 0) + 1);
      if (capabilityFor(source, userId, slot.roleId)?.proficiency === "primary") {
        primaryAssignments += 1;
      }
      if (volunteersById.get(userId)?.availability[serviceDate] === "preferred") {
        preferredAssignments += 1;
      }
    }

    for (const requirement of service.requirements) {
      const lockedCount = lockedByServiceRole.get(`${service.id}:${requirement.roleId}`)?.length ?? 0;
      const matchedCount = serviceAssignments.filter(
        ({ slot }) => slot.roleId === requirement.roleId,
      ).length;
      const assignedCount = lockedCount + matchedCount;
      if (assignedCount < requirement.requiredCount) {
        unfilledRoles.push({
          serviceId: service.id,
          roleId: requirement.roleId,
          requiredCount: requirement.requiredCount,
          assignedCount,
          missingCount: requirement.requiredCount - assignedCount,
        });
      }
    }
  }

  return { assignments, unfilledRoles, assignmentCounts, primaryAssignments, preferredAssignments };
}

function buildDraft(
  source: RosterGenerationSource,
  weights: RosterGenerationWeights,
  algorithm: string,
  match: MatchResult,
): GeneratedCandidateDraft {
  const { assignments, unfilledRoles, assignmentCounts, primaryAssignments, preferredAssignments } = match;
  const totalRequired = totalRequiredCount(source);

  const loadPenalty = [...assignmentCounts.values()].reduce(
    (sum, count) => sum + count * count * weights.loadBalance,
    0,
  );
  const objectiveScore =
    assignments.length * 1_000 +
    primaryAssignments * weights.primaryRole +
    preferredAssignments * weights.preferredAvailability -
    loadPenalty;
  const configuration = { algorithm, weights };
  const assignmentCountValues = [...assignmentCounts.values()];
  const minAssignments = assignmentCountValues.length ? Math.min(...assignmentCountValues) : 0;
  const maxAssignments = assignmentCountValues.length ? Math.max(...assignmentCountValues) : 0;
  const meanAssignments = assignmentCountValues.length
    ? Math.round((assignments.length / assignmentCountValues.length) * 100) / 100
    : 0;
  const coveragePercentage =
    totalRequired === 0 ? 100 : Math.round((assignments.length / totalRequired) * 1000) / 10;
  const explanation = {
    coverage: {
      totalRequired,
      totalAssigned: assignments.length,
      unfilledCount: unfilledRoles.length,
      coveragePercentage,
    },
    fairness: {
      assignmentCountsByUser: Object.fromEntries(assignmentCounts),
      minAssignments,
      maxAssignments,
      meanAssignments,
      spread: maxAssignments - minAssignments,
    },
    primaryAssignments,
    preferredAssignments,
    unfilledRoles,
    infeasible: unfilledRoles.length > 0,
  };

  return {
    planningPeriodId: source.planningPeriodId,
    hardConstraintsSatisfied: unfilledRoles.length === 0,
    objectiveScore,
    configuration,
    explanation,
    assignments,
    unfilledRoles,
  };
}

export function generateRosterCandidate(
  source: RosterGenerationSource,
  weights: RosterGenerationWeights,
): GeneratedCandidateDraft {
  const match = matchAssignments(source, weights, []);
  return buildDraft(source, weights, "deterministic-bipartite-matching-v1", match);
}

/**
 * Regenerates a candidate honoring previously locked assignments: locked
 * slots are kept exactly as-is, and only the remaining required roles are
 * recalculated. Locks that no longer satisfy a hard constraint (the
 * volunteer became inactive/unqualified/unavailable, or the role
 * requirement shrank below the locked count) are reported instead of being
 * silently dropped or overridden.
 */
export function regenerateRosterCandidate(
  source: RosterGenerationSource,
  weights: RosterGenerationWeights,
  lockedAssignments: ReadonlyArray<LockedAssignment>,
): RegenerationResult {
  const infeasibleLocks = findInfeasibleLocks(source, lockedAssignments);
  if (infeasibleLocks.length > 0) {
    return { ok: false, infeasibleLocks };
  }

  const match = matchAssignments(source, weights, lockedAssignments);
  return { ok: true, draft: buildDraft(source, weights, "deterministic-bipartite-matching-v1-with-locks", match) };
}
