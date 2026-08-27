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
}

export type Actor = Pick<AuthenticatedPrincipal, "userId">;
