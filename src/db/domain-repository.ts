import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type {
  AvailabilityInput,
  DateRange,
  DomainRepository,
  GeneratedCandidateDraft,
  MemberRoleInput,
  PlanningPeriodInput,
  RosterGenerationSource,
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

    async getRosterGenerationSource(planningPeriodId: string) {
      const [period] = await database
        .select({
          id: planningPeriods.id,
          startsOn: planningPeriods.startsOn,
          endsOn: planningPeriods.endsOn,
        })
        .from(planningPeriods)
        .where(eq(planningPeriods.id, planningPeriodId))
        .limit(1);
      if (!period) return null;

      const serviceRecords = await database
        .select({ id: services.id, startsAt: services.startsAt })
        .from(services)
        .where(eq(services.planningPeriodId, planningPeriodId))
        .orderBy(asc(services.startsAt), asc(services.id));
      const requirementRecords = await database
        .select({
          serviceId: serviceRoleRequirements.serviceId,
          roleId: serviceRoleRequirements.roleId,
          requiredCount: serviceRoleRequirements.requiredCount,
        })
        .from(serviceRoleRequirements)
        .innerJoin(services, eq(serviceRoleRequirements.serviceId, services.id))
        .where(eq(services.planningPeriodId, planningPeriodId))
        .orderBy(asc(serviceRoleRequirements.roleId));
      const capabilityRecords = await database
        .select({
          userId: users.id,
          isActive: users.isActive,
          roleId: userRoles.roleId,
          proficiency: userRoles.proficiency,
        })
        .from(userRoles)
        .innerJoin(users, eq(userRoles.userId, users.id))
        .orderBy(asc(users.id), asc(userRoles.roleId));
      const availabilityRecords = await database
        .select({
          userId: availability.userId,
          serviceDate: availability.serviceDate,
          status: availability.status,
        })
        .from(availability)
        .where(
          and(
            gte(availability.serviceDate, period.startsOn),
            lte(availability.serviceDate, period.endsOn),
          ),
        );

      const requirementsByService = new Map<
        string,
        Array<{ roleId: string; requiredCount: number }>
      >();
      for (const requirement of requirementRecords) {
        const requirements = requirementsByService.get(requirement.serviceId) ?? [];
        requirements.push({
          roleId: requirement.roleId,
          requiredCount: requirement.requiredCount,
        });
        requirementsByService.set(requirement.serviceId, requirements);
      }

      const volunteersById = new Map<
        string,
        {
          userId: string;
          isActive: boolean;
          capabilities: Array<{
            roleId: string;
            proficiency: "primary" | "secondary";
          }>;
          availability: Record<string, "available" | "unavailable" | "preferred">;
        }
      >();
      for (const capability of capabilityRecords) {
        const volunteer = volunteersById.get(capability.userId) ?? {
          userId: capability.userId,
          isActive: capability.isActive,
          capabilities: [],
          availability: {},
        };
        volunteer.capabilities.push({
          roleId: capability.roleId,
          proficiency: capability.proficiency,
        });
        volunteersById.set(capability.userId, volunteer);
      }
      for (const record of availabilityRecords) {
        const volunteer = volunteersById.get(record.userId);
        if (volunteer) volunteer.availability[record.serviceDate] = record.status;
      }

      return {
        planningPeriodId,
        services: serviceRecords.map((service) => ({
          ...service,
          requirements: requirementsByService.get(service.id) ?? [],
        })),
        volunteers: [...volunteersById.values()],
      } satisfies RosterGenerationSource;
    },

    async saveGeneratedCandidate(candidate: GeneratedCandidateDraft, actorUserId: string) {
      return database.transaction(async (transaction) => {
        const [latest] = await transaction
          .select({
            version: sql<number>`coalesce(max(${rosterCandidates.version}), 0)`,
          })
          .from(rosterCandidates)
          .where(eq(rosterCandidates.planningPeriodId, candidate.planningPeriodId));
        const version = Number(latest.version) + 1;
        const [record] = await transaction
          .insert(rosterCandidates)
          .values({
            planningPeriodId: candidate.planningPeriodId,
            version,
            status: "draft",
            hardConstraintsSatisfied: candidate.hardConstraintsSatisfied,
            objectiveScore: candidate.objectiveScore.toFixed(4),
            configuration: candidate.configuration,
            explanation: candidate.explanation,
            createdBy: actorUserId,
          })
          .returning();
        const insertedAssignments = candidate.assignments.length
          ? await transaction
              .insert(assignments)
              .values(
                candidate.assignments.map((assignment) => ({
                  candidateId: record.id,
                  serviceId: assignment.serviceId,
                  roleId: assignment.roleId,
                  userId: assignment.userId,
                  isLocked: assignment.isLocked ?? false,
                  source: "solver" as const,
                })),
              )
              .returning({
                id: assignments.id,
                serviceId: assignments.serviceId,
                roleId: assignments.roleId,
                userId: assignments.userId,
                isLocked: assignments.isLocked,
              })
          : [];
        await transaction.insert(auditEvents).values({
          actorUserId,
          action: "roster_candidate.generated",
          entityType: "roster_candidate",
          entityId: record.id,
          metadata: {
            planningPeriodId: candidate.planningPeriodId,
            version,
            assignmentCount: candidate.assignments.length,
            unfilledRoleCount: candidate.unfilledRoles.length,
            hardConstraintsSatisfied: candidate.hardConstraintsSatisfied,
          },
        });
        return {
          candidate: {
            id: record.id,
            planningPeriodId: record.planningPeriodId,
            version: record.version,
            status: "draft" as const,
            hardConstraintsSatisfied: record.hardConstraintsSatisfied,
            objectiveScore: record.objectiveScore,
            configuration: record.configuration,
            explanation: record.explanation,
          },
          assignments: insertedAssignments,
        };
      });
    },

    async listRosterCandidates(planningPeriodId: string) {
      return database
        .select({
          id: rosterCandidates.id,
          planningPeriodId: rosterCandidates.planningPeriodId,
          version: rosterCandidates.version,
          status: rosterCandidates.status,
          hardConstraintsSatisfied: rosterCandidates.hardConstraintsSatisfied,
          objectiveScore: rosterCandidates.objectiveScore,
          explanation: rosterCandidates.explanation,
          generatedAt: rosterCandidates.generatedAt,
        })
        .from(rosterCandidates)
        .where(eq(rosterCandidates.planningPeriodId, planningPeriodId))
        .orderBy(desc(rosterCandidates.version));
    },

    async getRosterCandidateDetail(candidateId: string) {
      const [candidate] = await database
        .select({
          id: rosterCandidates.id,
          planningPeriodId: rosterCandidates.planningPeriodId,
          version: rosterCandidates.version,
          status: rosterCandidates.status,
          hardConstraintsSatisfied: rosterCandidates.hardConstraintsSatisfied,
          objectiveScore: rosterCandidates.objectiveScore,
          configuration: rosterCandidates.configuration,
          explanation: rosterCandidates.explanation,
          generatedAt: rosterCandidates.generatedAt,
        })
        .from(rosterCandidates)
        .where(eq(rosterCandidates.id, candidateId))
        .limit(1);
      if (!candidate) return null;

      const assignmentRecords = await database
        .select({
          id: assignments.id,
          serviceId: services.id,
          serviceTitle: services.title,
          serviceStartsAt: services.startsAt,
          roleId: roles.id,
          roleName: roles.name,
          userId: users.id,
          userDisplayName: users.displayName,
          isLocked: assignments.isLocked,
          source: assignments.source,
        })
        .from(assignments)
        .innerJoin(services, eq(assignments.serviceId, services.id))
        .innerJoin(roles, eq(assignments.roleId, roles.id))
        .innerJoin(users, eq(assignments.userId, users.id))
        .where(eq(assignments.candidateId, candidateId))
        .orderBy(asc(services.startsAt), asc(roles.name), asc(users.displayName));

      return { candidate, assignments: assignmentRecords };
    },

    async setAssignmentLock(
      candidateId: string,
      assignmentId: string,
      isLocked: boolean,
      actorUserId: string,
    ) {
      return database.transaction(async (transaction) => {
        const [record] = await transaction
          .select({ id: assignments.id, status: rosterCandidates.status })
          .from(assignments)
          .innerJoin(rosterCandidates, eq(assignments.candidateId, rosterCandidates.id))
          .where(and(eq(assignments.id, assignmentId), eq(assignments.candidateId, candidateId)))
          .limit(1);
        if (!record) throw new ApiError("assignment_not_found", 404, "Assignment not found");
        if (record.status !== "draft") {
          throw new ApiError(
            "candidate_not_editable",
            409,
            "Only a draft candidate's assignments can be locked or unlocked",
          );
        }
        const [updated] = await transaction
          .update(assignments)
          .set({ isLocked, updatedAt: new Date() })
          .where(eq(assignments.id, assignmentId))
          .returning({ id: assignments.id, isLocked: assignments.isLocked });
        await transaction.insert(auditEvents).values({
          actorUserId,
          action: "assignment.lock_updated",
          entityType: "assignment",
          entityId: assignmentId,
          metadata: { candidateId, isLocked },
        });
        return updated;
      });
    },

    async publishRosterCandidate(candidateId: string, actorUserId: string) {
      return database.transaction(async (transaction) => {
        const [candidate] = await transaction
          .select({
            id: rosterCandidates.id,
            planningPeriodId: rosterCandidates.planningPeriodId,
            version: rosterCandidates.version,
            status: rosterCandidates.status,
            hardConstraintsSatisfied: rosterCandidates.hardConstraintsSatisfied,
          })
          .from(rosterCandidates)
          .where(eq(rosterCandidates.id, candidateId))
          .limit(1);
        if (!candidate) throw new ApiError("roster_candidate_not_found", 404, "Roster candidate not found");
        if (candidate.status !== "draft") {
          throw new ApiError("candidate_not_publishable", 409, "Only a draft candidate can be published");
        }
        if (!candidate.hardConstraintsSatisfied) {
          throw new ApiError(
            "roster_infeasible",
            409,
            "This candidate does not satisfy all hard constraints and cannot be published",
          );
        }

        const superseded = await transaction
          .update(rosterCandidates)
          .set({ status: "superseded" })
          .where(
            and(
              eq(rosterCandidates.planningPeriodId, candidate.planningPeriodId),
              eq(rosterCandidates.status, "published"),
            ),
          )
          .returning({ id: rosterCandidates.id });

        const [published] = await transaction
          .update(rosterCandidates)
          .set({ status: "published" })
          .where(and(eq(rosterCandidates.id, candidateId), eq(rosterCandidates.status, "draft")))
          .returning({
            id: rosterCandidates.id,
            planningPeriodId: rosterCandidates.planningPeriodId,
            version: rosterCandidates.version,
            status: rosterCandidates.status,
          });
        if (!published) {
          throw new ApiError("candidate_not_publishable", 409, "Only a draft candidate can be published");
        }

        await transaction.insert(auditEvents).values({
          actorUserId,
          action: "roster_candidate.published",
          entityType: "roster_candidate",
          entityId: candidateId,
          metadata: {
            planningPeriodId: candidate.planningPeriodId,
            version: candidate.version,
            supersededCandidateIds: superseded.map((row) => row.id),
          },
        });

        return { ...published, status: "published" as const };
      });
    },
  };
}
