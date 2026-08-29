import { ApiError } from "@/api/errors";
import type {
  Actor,
  AvailabilityInput,
  DateRange,
  DomainRepository,
  MemberRoleInput,
  PendingUserInput,
  PlanningPeriodInput,
  RosterGenerationRequest,
  ServiceInput,
} from "./types";
import {
  defaultRosterGenerationWeights,
  generateRosterCandidate,
  regenerateRosterCandidate,
} from "./roster-generator";

const applicationTimeZone = "Asia/Singapore";

function calendarDateInTimeZone(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: applicationTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((candidate) => candidate.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function validateDateRange(range: DateRange) {
  if (range.from > range.to) {
    throw new ApiError("invalid_date_range", 400, "from must be on or before to");
  }
  if (range.to > addDays(range.from, 366)) {
    throw new ApiError("date_range_too_large", 400, "Date range cannot exceed 366 days");
  }
}

export class SmartRosterService {
  constructor(
    private readonly repository: DomainRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  listPlanningPeriods() {
    return this.repository.listPlanningPeriods();
  }

  createPlanningPeriod(input: PlanningPeriodInput, actor: Actor) {
    return this.repository.createPlanningPeriod(input, actor.userId);
  }

  listServices(planningPeriodId: string) {
    return this.repository.listServices(planningPeriodId);
  }

  async createService(input: ServiceInput, actor: Actor) {
    const period = await this.repository.getPlanningPeriod(input.planningPeriodId);
    if (!period) throw new ApiError("planning_period_not_found", 404, "Planning period not found");
    const serviceDate = calendarDateInTimeZone(input.startsAt);
    if (serviceDate < period.startsOn || serviceDate > period.endsOn) {
      throw new ApiError(
        "service_outside_planning_period",
        400,
        "Service date must fall inside the planning period",
      );
    }
    return this.repository.createService(input, actor.userId);
  }

  listRoles() {
    return this.repository.listRoles();
  }

  createPendingUser(input: PendingUserInput, actor: Actor) {
    return this.repository.createPendingUser(input, actor.userId);
  }

  listUsers() {
    return this.repository.listUsersWithRoles();
  }

  replaceMemberRoles(userId: string, capabilities: MemberRoleInput, actor: Actor) {
    return this.repository.replaceMemberRoles(userId, capabilities, actor.userId);
  }

  listMyAvailability(userId: string, input: Partial<DateRange>) {
    const today = calendarDateInTimeZone(this.now());
    const range = { from: input.from ?? today, to: input.to ?? addDays(today, 90) };
    validateDateRange(range);
    return this.repository.listAvailability(userId, range);
  }

  setMyAvailability(userId: string, input: AvailabilityInput) {
    const today = calendarDateInTimeZone(this.now());
    if (input.serviceDate < today) {
      throw new ApiError("past_availability_date", 400, "Past availability dates cannot be changed");
    }
    return this.repository.upsertAvailability(userId, input, userId);
  }

  async listMyUpcomingAssignments(userId: string, from?: Date, to?: Date) {
    const effectiveFrom = from ?? this.now();
    if (to && to < effectiveFrom) {
      throw new ApiError("invalid_date_range", 400, "to must be after from");
    }
    const assignments = await this.repository.listUpcomingAssignments(userId, effectiveFrom, to);
    return assignments.map((assignment) => ({
      ...assignment,
      startsAt: assignment.startsAt.toISOString(),
      serviceDate: calendarDateInTimeZone(assignment.startsAt),
      serviceTime: new Intl.DateTimeFormat("en-GB", {
        timeZone: applicationTimeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(assignment.startsAt),
    }));
  }

  async generateCandidate(
    planningPeriodId: string,
    input: RosterGenerationRequest,
    actor: Actor,
  ) {
    const source = await this.repository.getRosterGenerationSource(planningPeriodId);
    if (!source) {
      throw new ApiError("planning_period_not_found", 404, "Planning period not found");
    }
    const totalRequired = source.services.reduce(
      (total, service) =>
        total + service.requirements.reduce((sum, requirement) => sum + requirement.requiredCount, 0),
      0,
    );
    if (totalRequired === 0) {
      throw new ApiError(
        "no_service_requirements",
        409,
        "The planning period has no service role requirements",
      );
    }
    const weights = { ...defaultRosterGenerationWeights, ...input.weights };
    const generated = generateRosterCandidate(source, weights);
    const persisted = await this.repository.saveGeneratedCandidate(generated, actor.userId);
    return { ...persisted, unfilledRoles: generated.unfilledRoles };
  }

  async listRosterCandidates(planningPeriodId: string) {
    const period = await this.repository.getPlanningPeriod(planningPeriodId);
    if (!period) throw new ApiError("planning_period_not_found", 404, "Planning period not found");
    return this.repository.listRosterCandidates(planningPeriodId);
  }

  async getRosterCandidateDetail(planningPeriodId: string, candidateId: string) {
    const detail = await this.repository.getRosterCandidateDetail(candidateId);
    if (!detail || detail.candidate.planningPeriodId !== planningPeriodId) {
      throw new ApiError("roster_candidate_not_found", 404, "Roster candidate not found");
    }
    return detail;
  }

  async setAssignmentLock(
    planningPeriodId: string,
    candidateId: string,
    assignmentId: string,
    isLocked: boolean,
    actor: Actor,
  ) {
    const detail = await this.repository.getRosterCandidateDetail(candidateId);
    if (!detail || detail.candidate.planningPeriodId !== planningPeriodId) {
      throw new ApiError("roster_candidate_not_found", 404, "Roster candidate not found");
    }
    return this.repository.setAssignmentLock(candidateId, assignmentId, isLocked, actor.userId);
  }

  async regenerateCandidate(
    planningPeriodId: string,
    candidateId: string,
    input: RosterGenerationRequest,
    actor: Actor,
  ) {
    const source = await this.repository.getRosterGenerationSource(planningPeriodId);
    if (!source) {
      throw new ApiError("planning_period_not_found", 404, "Planning period not found");
    }
    const previous = await this.repository.getRosterCandidateDetail(candidateId);
    if (!previous || previous.candidate.planningPeriodId !== planningPeriodId) {
      throw new ApiError("roster_candidate_not_found", 404, "Roster candidate not found");
    }

    const lockedAssignments = previous.assignments
      .filter((assignment) => assignment.isLocked)
      .map((assignment) => ({
        serviceId: assignment.serviceId,
        roleId: assignment.roleId,
        userId: assignment.userId,
      }));

    const weights = { ...defaultRosterGenerationWeights, ...input.weights };
    const result = regenerateRosterCandidate(source, weights, lockedAssignments);
    if (!result.ok) {
      throw new ApiError(
        "infeasible_lock",
        409,
        "One or more locked assignments are no longer feasible",
        { infeasibleLocks: result.infeasibleLocks },
      );
    }

    const draft = {
      ...result.draft,
      configuration: { ...result.draft.configuration, regeneratedFromCandidateId: candidateId },
    };
    const persisted = await this.repository.saveGeneratedCandidate(draft, actor.userId);
    return { ...persisted, unfilledRoles: draft.unfilledRoles };
  }

  async publishCandidate(planningPeriodId: string, candidateId: string, actor: Actor) {
    const detail = await this.repository.getRosterCandidateDetail(candidateId);
    if (!detail || detail.candidate.planningPeriodId !== planningPeriodId) {
      throw new ApiError("roster_candidate_not_found", 404, "Roster candidate not found");
    }
    return this.repository.publishRosterCandidate(candidateId, actor.userId);
  }
}
