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

export type PendingUserInput = Readonly<{
  email: string;
  displayName: string;
  systemRole: "volunteer" | "team_leader" | "administrator";
}>;

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
  isLocked?: boolean;
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

export type RosterCandidateSummary = Readonly<{
  id: string;
  planningPeriodId: string;
  version: number;
  status: "draft" | "published" | "superseded";
  hardConstraintsSatisfied: boolean;
  objectiveScore: string | null;
  explanation: Record<string, unknown>;
  generatedAt: Date;
}>;

export type RosterCandidateAssignmentDetail = Readonly<{
  id: string;
  serviceId: string;
  serviceTitle: string;
  serviceStartsAt: Date;
  roleId: string;
  roleName: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  isLocked: boolean;
  source: "solver" | "manual";
}>;

export type RosterCandidateDetail = Readonly<{
  candidate: RosterCandidateSummary & { configuration: Record<string, unknown> };
  assignments: ReadonlyArray<RosterCandidateAssignmentDetail>;
}>;

export type NotificationStatus = "pending" | "sent" | "failed";

export type PendingNotificationInput = Readonly<{
  userId: string;
  recipientEmail: string;
  eventType: string;
  idempotencyKey: string;
}>;

export type NotificationDelivery = Readonly<{
  id: string;
  userId: string;
  recipientEmail: string;
  eventType: string;
  idempotencyKey: string;
  status: NotificationStatus;
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
  createPendingUser(
    input: PendingUserInput,
    actorUserId: string,
  ): Promise<{ id: string; email: string; displayName: string; systemRole: string }>;
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
  listRosterCandidates(planningPeriodId: string): Promise<RosterCandidateSummary[]>;
  getRosterCandidateDetail(candidateId: string): Promise<RosterCandidateDetail | null>;
  setAssignmentLock(
    candidateId: string,
    assignmentId: string,
    isLocked: boolean,
    actorUserId: string,
  ): Promise<{ id: string; isLocked: boolean }>;
  publishRosterCandidate(
    candidateId: string,
    actorUserId: string,
  ): Promise<{ id: string; planningPeriodId: string; version: number; status: "published" }>;
  /**
   * Inserts any notifications that don't already exist for their
   * idempotency key, then returns every matching notification (freshly
   * inserted or pre-existing) that has not yet been sent - so a retried
   * call picks up anything still pending/failed without ever re-sending
   * one already marked "sent" or creating a duplicate row.
   */
  getOrCreateNotifications(
    entries: ReadonlyArray<PendingNotificationInput>,
  ): Promise<NotificationDelivery[]>;
  markNotificationSent(notificationId: string, providerMessageId: string): Promise<void>;
  markNotificationFailed(notificationId: string, error: string): Promise<void>;
}

export type Actor = Pick<AuthenticatedPrincipal, "userId">;
