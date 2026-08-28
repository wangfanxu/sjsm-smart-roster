import type { AuthenticatedPrincipal } from "@/auth/types";

export type PlanningPeriodInput = Readonly<{
  name: string;
  startsOn: string;
  endsOn: string;
}>;

export type ServiceInput = Readonly<{
  planningPeriodId: string;
  title: string;
  startsAt: Date;
  notes?: string | null;
  requirements: ReadonlyArray<Readonly<{ roleId: string; requiredCount: number }>>;
}>;

export type MemberRoleInput = ReadonlyArray<
  Readonly<{ roleId: string; proficiency: "primary" | "secondary" }>
>;

export type AvailabilityInput = Readonly<{
  serviceDate: string;
  status: "available" | "unavailable" | "preferred";
  note?: string | null;
}>;

export type DateRange = Readonly<{ from: string; to: string }>;

export type RosterGenerationWeights = Readonly<{
  primaryRole: number;
  preferredAvailability: number;
  loadBalance: number;
}>;

export type RosterGenerationRequest = Readonly<{
  weights?: Partial<RosterGenerationWeights>;
}>;

export type RosterGenerationSource = Readonly<{
  planningPeriodId: string;
  services: ReadonlyArray<
    Readonly<{
      id: string;
      startsAt: Date;
      requirements: ReadonlyArray<
        Readonly<{ roleId: string; requiredCount: number }>
      >;
    }>
  >;
  volunteers: ReadonlyArray<
    Readonly<{
      userId: string;
      isActive: boolean;
      capabilities: ReadonlyArray<
        Readonly<{ roleId: string; proficiency: "primary" | "secondary" }>
      >;
      availability: Readonly<Record<string, "available" | "unavailable" | "preferred">>;
    }>
  >;
}>;

export type GeneratedAssignment = Readonly<{
  serviceId: string;
  roleId: string;
  userId: string;
}>;

export type UnfilledRole = Readonly<{
  serviceId: string;
  roleId: string;
  requiredCount: number;
  assignedCount: number;
  missingCount: number;
}>;

export type GeneratedCandidateDraft = Readonly<{
  planningPeriodId: string;
  hardConstraintsSatisfied: boolean;
  objectiveScore: number;
  configuration: Record<string, unknown>;
  explanation: Record<string, unknown>;
  assignments: ReadonlyArray<GeneratedAssignment>;
  unfilledRoles: ReadonlyArray<UnfilledRole>;
}>;

export type PersistedCandidate = Readonly<{
  candidate: {
    id: string;
    planningPeriodId: string;
    version: number;
    status: "draft";
    hardConstraintsSatisfied: boolean;
    objectiveScore: string | null;
    configuration: Record<string, unknown>;
    explanation: Record<string, unknown>;
  };
  assignments: ReadonlyArray<GeneratedAssignment & { id: string }>;
}>;

export interface DomainRepository {
  listPlanningPeriods(): Promise<unknown[]>;
  createPlanningPeriod(input: PlanningPeriodInput, actorUserId: string): Promise<unknown>;
  listServices(planningPeriodId: string): Promise<unknown[]>;
  getPlanningPeriod(planningPeriodId: string): Promise<{
    id: string;
    startsOn: string;
    endsOn: string;
  } | null>;
  createService(input: ServiceInput, actorUserId: string): Promise<unknown>;
  listRoles(): Promise<unknown[]>;
  replaceMemberRoles(
    userId: string,
    capabilities: MemberRoleInput,
    actorUserId: string,
  ): Promise<unknown[]>;
  listAvailability(userId: string, range: DateRange): Promise<unknown[]>;
  upsertAvailability(
    userId: string,
    input: AvailabilityInput,
    actorUserId: string,
  ): Promise<unknown>;
  listUpcomingAssignments(userId: string, from: Date, to?: Date): Promise<
    Array<{
      assignmentId: string;
      serviceId: string;
      startsAt: Date;
      title: string;
      role: string;
    }>
  >;
  listEligibleUsersForServiceRole(
    serviceId: string,
    roleId: string,
  ): Promise<Array<{ userId: string; proficiency: "primary" | "secondary" }>>;
  getRosterGenerationSource(planningPeriodId: string): Promise<RosterGenerationSource | null>;
  saveGeneratedCandidate(
    candidate: GeneratedCandidateDraft,
    actorUserId: string,
  ): Promise<PersistedCandidate>;
}

export type Actor = Pick<AuthenticatedPrincipal, "userId">;
