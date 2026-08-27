import { and, asc, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type {
  AvailabilityInput,
  DateRange,
  DomainRepository,
  MemberRoleInput,
  PlanningPeriodInput,
  ServiceInput,
} from "@/domain/types";
import * as schema from "./schema";
import {
  assignments,
  auditEvents,
  availability,
  planningPeriods,
  roles,
  rosterCandidates,
  serviceRoleRequirements,
  services,
  userRoles,
  users,
} from "./schema";
import { ApiError } from "@/api/errors";

export function createDomainRepository(
  database: PostgresJsDatabase<typeof schema>,
): DomainRepository {
  return {
    async listPlanningPeriods() {
      return database.select().from(planningPeriods).orderBy(asc(planningPeriods.startsOn));
    },

    async createPlanningPeriod(input: PlanningPeriodInput, actorUserId: string) {
      return database.transaction(async (transaction) => {
        const [period] = await transaction
          .insert(planningPeriods)
          .values({ ...input, createdBy: actorUserId })
          .returning();
        await transaction.insert(auditEvents).values({
          actorUserId,
          action: "planning_period.created",
          entityType: "planning_period",
          entityId: period.id,
          metadata: { startsOn: input.startsOn, endsOn: input.endsOn },
        });
        return period;
      });
    },

    async listServices(planningPeriodId: string) {
      return database
        .select()
        .from(services)
        .where(eq(services.planningPeriodId, planningPeriodId))
        .orderBy(asc(services.startsAt));
    },

    async getPlanningPeriod(planningPeriodId: string) {
      const [period] = await database
        .select({ id: planningPeriods.id, startsOn: planningPeriods.startsOn, endsOn: planningPeriods.endsOn })
        .from(planningPeriods)
        .where(eq(planningPeriods.id, planningPeriodId))
        .limit(1);
      return period ?? null;
    },

    async createService(input: ServiceInput, actorUserId: string) {
      return database.transaction(async (transaction) => {
        const roleRecords = await transaction
          .select({ id: roles.id })
          .from(roles)
          .where(inArray(roles.id, input.requirements.map((requirement) => requirement.roleId)));
        if (roleRecords.length !== input.requirements.length) {
          throw new ApiError("role_not_found", 404, "One or more roles do not exist");
        }
        const [service] = await transaction
          .insert(services)
          .values({
            planningPeriodId: input.planningPeriodId,
            title: input.title,
            startsAt: input.startsAt,
            notes: input.notes,
          })
          .returning();
        await transaction.insert(serviceRoleRequirements).values(
          input.requirements.map((requirement) => ({ serviceId: service.id, ...requirement })),
        );
        await transaction.insert(auditEvents).values({
          actorUserId,
          action: "service.created",
          entityType: "service",
          entityId: service.id,
          metadata: { planningPeriodId: input.planningPeriodId },
        });
        return service;
      });
    },

    async listRoles() {
      return database.select().from(roles).orderBy(asc(roles.name));
    },

    async replaceMemberRoles(userId: string, capabilities: MemberRoleInput, actorUserId: string) {
      const [member] = await database.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
      if (!member) throw new ApiError("user_not_found", 404, "User not found");
      if (capabilities.length > 0) {
        const roleRecords = await database
          .select({ id: roles.id })
          .from(roles)
          .where(inArray(roles.id, capabilities.map((capability) => capability.roleId)));
        if (roleRecords.length !== capabilities.length) {
          throw new ApiError("role_not_found", 404, "One or more roles do not exist");
        }
      }
      return database.transaction(async (transaction) => {
        await transaction.delete(userRoles).where(eq(userRoles.userId, userId));
        const inserted = capabilities.length
          ? await transaction
              .insert(userRoles)
              .values(capabilities.map((capability) => ({ userId, ...capability })))
              .returning()
          : [];
        await transaction.insert(auditEvents).values({
          actorUserId,
          action: "user_roles.replaced",
          entityType: "user",
          entityId: userId,
          metadata: { roleCount: capabilities.length },
        });
        return inserted;
      });
    },

    async listAvailability(userId: string, range: DateRange) {
      return database
        .select()
        .from(availability)
        .where(
          and(
            eq(availability.userId, userId),
            gte(availability.serviceDate, range.from),
            lte(availability.serviceDate, range.to),
          ),
        )
        .orderBy(asc(availability.serviceDate));
    },

    async upsertAvailability(userId: string, input: AvailabilityInput, actorUserId: string) {
      return database.transaction(async (transaction) => {
        const [record] = await transaction
          .insert(availability)
          .values({ userId, ...input, updatedBy: actorUserId })
          .onConflictDoUpdate({
            target: [availability.userId, availability.serviceDate],
            set: {
              status: input.status,
              note: input.note,
              updatedBy: actorUserId,
              updatedAt: new Date(),
            },
          })
          .returning();
        await transaction.insert(auditEvents).values({
          actorUserId,
          action: "availability.upserted",
          entityType: "availability",
          entityId: `${userId}:${input.serviceDate}`,
          metadata: { serviceDate: input.serviceDate, status: input.status },
        });
        return record;
      });
    },

    async listUpcomingAssignments(userId: string, from: Date, to?: Date) {
      const conditions = [
        eq(assignments.userId, userId),
        eq(rosterCandidates.status, "published"),
        gte(services.startsAt, from),
      ];
      if (to) conditions.push(lte(services.startsAt, to));
      return database
        .select({
          assignmentId: assignments.id,
          serviceId: services.id,
          startsAt: services.startsAt,
          title: services.title,
          role: roles.name,
        })
        .from(assignments)
        .innerJoin(rosterCandidates, eq(assignments.candidateId, rosterCandidates.id))
        .innerJoin(services, eq(assignments.serviceId, services.id))
        .innerJoin(roles, eq(assignments.roleId, roles.id))
        .where(and(...conditions))
        .orderBy(asc(services.startsAt));
    },

    async listEligibleUsersForServiceRole(serviceId: string, roleId: string) {
      return database
        .select({ userId: users.id, proficiency: userRoles.proficiency })
        .from(userRoles)
        .innerJoin(users, eq(userRoles.userId, users.id))
        .innerJoin(services, eq(services.id, serviceId))
        .leftJoin(
          availability,
          and(
            eq(availability.userId, users.id),
            sql`${availability.serviceDate} = (${services.startsAt} AT TIME ZONE 'Asia/Singapore')::date`,
          ),
        )
        .where(
          and(
            eq(userRoles.roleId, roleId),
            eq(users.isActive, true),
            or(isNull(availability.status), ne(availability.status, "unavailable")),
          ),
        )
        .orderBy(asc(users.id));
    },
  };
}
