import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type {
  AvailabilityInput,
  CreateRoleInput,
  DateRange,
  DomainRepository,
  GeneratedCandidateDraft,
  MemberRoleInput,
  PendingNotificationInput,
  PendingUserInput,
  PlanningPeriodInput,
  RosterGenerationSource,
  ServiceInput,
  ServiceRoleRequirement,
  ServiceSong,
  ServiceSongsInput,
  ServiceUpdateInput,
  UserWithRoles,
} from "@/domain/types";
import * as schema from "./schema";
import {
  assignments,
  auditEvents,
  availability,
  notificationDeliveries,
  planningPeriods,
  replacementRequests,
  roles,
  rosterCandidates,
  serviceRoleRequirements,
  serviceSongs,
  services,
  userRoles,
  users,
} from "./schema";
import { ApiError } from "@/api/errors";

export function createDomainRepository(
  database: PostgresJsDatabase<typeof schema>,
): DomainRepository {
  const requesterUsers = alias(users, "requester_users");
  const replacementUsers = alias(users, "replacement_users");

  function replacementRequestColumns() {
    return {
      id: replacementRequests.id,
      assignmentId: replacementRequests.assignmentId,
      status: replacementRequests.status,
      reason: replacementRequests.reason,
      requesterId: replacementRequests.requesterId,
      requesterDisplayName: requesterUsers.displayName,
      requesterEmail: requesterUsers.email,
      replacementUserId: replacementRequests.replacementUserId,
      replacementDisplayName: replacementUsers.displayName,
      replacementEmail: replacementUsers.email,
      serviceId: services.id,
      serviceTitle: services.title,
      serviceStartsAt: services.startsAt,
      roleId: roles.id,
      roleName: roles.name,
      createdAt: replacementRequests.createdAt,
    } as const;
  }

  function replacementRequestsBaseQuery() {
    return database
      .select(replacementRequestColumns())
      .from(replacementRequests)
      .innerJoin(assignments, eq(replacementRequests.assignmentId, assignments.id))
      .innerJoin(services, eq(assignments.serviceId, services.id))
      .innerJoin(roles, eq(assignments.roleId, roles.id))
      .innerJoin(requesterUsers, eq(replacementRequests.requesterId, requesterUsers.id))
      .leftJoin(replacementUsers, eq(replacementRequests.replacementUserId, replacementUsers.id));
  }

  const repository: DomainRepository = {
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

    async updatePlanningPeriod(planningPeriodId: string, input: PlanningPeriodInput, actorUserId: string) {
      return database.transaction(async (transaction) => {
        const [existing] = await transaction
          .select({ id: planningPeriods.id })
          .from(planningPeriods)
          .where(eq(planningPeriods.id, planningPeriodId))
          .limit(1);
        if (!existing) throw new ApiError("planning_period_not_found", 404, "Planning period not found");

        const [published] = await transaction
          .select({ id: rosterCandidates.id })
          .from(rosterCandidates)
          .where(
            and(eq(rosterCandidates.planningPeriodId, planningPeriodId), eq(rosterCandidates.status, "published")),
          )
          .limit(1);
        if (published) {
          throw new ApiError(
            "period_has_published_roster",
            409,
            "This planning period has a published roster and cannot be changed",
          );
        }

        const [outOfRange] = await transaction
          .select({ id: services.id })
          .from(services)
          .where(
            and(
              eq(services.planningPeriodId, planningPeriodId),
              or(
                sql`(${services.startsAt} AT TIME ZONE 'Asia/Singapore')::date < ${input.startsOn}::date`,
                sql`(${services.startsAt} AT TIME ZONE 'Asia/Singapore')::date > ${input.endsOn}::date`,
              ),
            ),
          )
          .limit(1);
        if (outOfRange) {
          throw new ApiError(
            "period_shrink_excludes_services",
            400,
            "The new dates would exclude an existing service - edit or remove it first",
          );
        }

        const [period] = await transaction
          .update(planningPeriods)
          .set({ name: input.name, startsOn: input.startsOn, endsOn: input.endsOn, updatedAt: new Date() })
          .where(eq(planningPeriods.id, planningPeriodId))
          .returning();
        await transaction.insert(auditEvents).values({
          actorUserId,
          action: "planning_period.updated",
          entityType: "planning_period",
          entityId: planningPeriodId,
          metadata: { startsOn: input.startsOn, endsOn: input.endsOn },
        });
        return period;
      });
    },

    async deletePlanningPeriod(planningPeriodId: string, actorUserId: string) {
      return database.transaction(async (transaction) => {
        const [existing] = await transaction
          .select({ id: planningPeriods.id })
          .from(planningPeriods)
          .where(eq(planningPeriods.id, planningPeriodId))
          .limit(1);
        if (!existing) throw new ApiError("planning_period_not_found", 404, "Planning period not found");

        const [published] = await transaction
          .select({ id: rosterCandidates.id })
          .from(rosterCandidates)
          .where(
            and(eq(rosterCandidates.planningPeriodId, planningPeriodId), eq(rosterCandidates.status, "published")),
          )
          .limit(1);
        if (published) {
          throw new ApiError(
            "period_has_published_roster",
            409,
            "This planning period has a published roster and cannot be deleted",
          );
        }

        await transaction.delete(planningPeriods).where(eq(planningPeriods.id, planningPeriodId));
        await transaction.insert(auditEvents).values({
          actorUserId,
          action: "planning_period.deleted",
          entityType: "planning_period",
          entityId: planningPeriodId,
          metadata: {},
        });
        return { id: planningPeriodId };
      });
    },

    async listServices(planningPeriodId: string) {
      const serviceRows = await database
        .select()
        .from(services)
        .where(eq(services.planningPeriodId, planningPeriodId))
        .orderBy(asc(services.startsAt));

      const requirementRows = await database
        .select({
          serviceId: serviceRoleRequirements.serviceId,
          roleId: serviceRoleRequirements.roleId,
          roleName: roles.name,
          requiredCount: serviceRoleRequirements.requiredCount,
        })
        .from(serviceRoleRequirements)
        .innerJoin(roles, eq(serviceRoleRequirements.roleId, roles.id))
        .innerJoin(services, eq(serviceRoleRequirements.serviceId, services.id))
        .where(eq(services.planningPeriodId, planningPeriodId));

      const requirementsByService = new Map<string, ServiceRoleRequirement[]>();
      for (const row of requirementRows) {
        const list = requirementsByService.get(row.serviceId) ?? [];
        list.push({ roleId: row.roleId, roleName: row.roleName, requiredCount: row.requiredCount });
        requirementsByService.set(row.serviceId, list);
      }

      return serviceRows.map((service) => ({
        ...service,
        requirements: requirementsByService.get(service.id) ?? [],
      }));
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
          .select({ id: roles.id, name: roles.name })
          .from(roles)
          .where(inArray(roles.id, input.requirements.map((requirement) => requirement.roleId)));
        if (roleRecords.length !== input.requirements.length) {
          throw new ApiError("role_not_found", 404, "One or more roles do not exist");
        }
        const roleNameById = new Map(roleRecords.map((role) => [role.id, role.name]));
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
        return {
          ...service,
          requirements: input.requirements.map((requirement) => ({
            roleId: requirement.roleId,
            roleName: roleNameById.get(requirement.roleId)!,
            requiredCount: requirement.requiredCount,
          })),
        };
      });
    },

    async updateService(
      planningPeriodId: string,
      serviceId: string,
      input: ServiceUpdateInput,
      actorUserId: string,
    ) {
      return database.transaction(async (transaction) => {
        const [existing] = await transaction
          .select({ id: services.id })
          .from(services)
          .where(and(eq(services.id, serviceId), eq(services.planningPeriodId, planningPeriodId)))
          .limit(1);
        if (!existing) throw new ApiError("service_not_found", 404, "Service not found");

        const [published] = await transaction
          .select({ id: assignments.id })
          .from(assignments)
          .innerJoin(rosterCandidates, eq(assignments.candidateId, rosterCandidates.id))
          .where(and(eq(assignments.serviceId, serviceId), eq(rosterCandidates.status, "published")))
          .limit(1);
        if (published) {
          throw new ApiError(
            "service_has_published_assignments",
            409,
            "This service has assignments on a published roster and cannot be changed",
          );
        }

        const roleRecords = await transaction
          .select({ id: roles.id, name: roles.name })
          .from(roles)
          .where(inArray(roles.id, input.requirements.map((requirement) => requirement.roleId)));
        if (roleRecords.length !== input.requirements.length) {
          throw new ApiError("role_not_found", 404, "One or more roles do not exist");
        }
        const roleNameById = new Map(roleRecords.map((role) => [role.id, role.name]));

        const [service] = await transaction
          .update(services)
          .set({
            title: input.title,
            startsAt: input.startsAt,
            notes: input.notes ?? null,
            updatedAt: new Date(),
          })
          .where(eq(services.id, serviceId))
          .returning();

        await transaction
          .delete(serviceRoleRequirements)
          .where(eq(serviceRoleRequirements.serviceId, serviceId));
        await transaction.insert(serviceRoleRequirements).values(
          input.requirements.map((requirement) => ({ serviceId, ...requirement })),
        );

        await transaction.insert(auditEvents).values({
          actorUserId,
          action: "service.updated",
          entityType: "service",
          entityId: serviceId,
          metadata: { planningPeriodId },
        });

        return {
          ...service,
          requirements: input.requirements.map((requirement) => ({
            roleId: requirement.roleId,
            roleName: roleNameById.get(requirement.roleId)!,
            requiredCount: requirement.requiredCount,
          })),
        };
      });
    },

    async deleteService(planningPeriodId: string, serviceId: string, actorUserId: string) {
      return database.transaction(async (transaction) => {
        const [existing] = await transaction
          .select({ id: services.id })
          .from(services)
          .where(and(eq(services.id, serviceId), eq(services.planningPeriodId, planningPeriodId)))
          .limit(1);
        if (!existing) throw new ApiError("service_not_found", 404, "Service not found");

        const [published] = await transaction
          .select({ id: assignments.id })
          .from(assignments)
          .innerJoin(rosterCandidates, eq(assignments.candidateId, rosterCandidates.id))
          .where(and(eq(assignments.serviceId, serviceId), eq(rosterCandidates.status, "published")))
          .limit(1);
        if (published) {
          throw new ApiError(
            "service_has_published_assignments",
            409,
            "This service has assignments on a published roster and cannot be deleted",
          );
        }

        await transaction.delete(services).where(eq(services.id, serviceId));
        await transaction.insert(auditEvents).values({
          actorUserId,
          action: "service.deleted",
          entityType: "service",
          entityId: serviceId,
          metadata: { planningPeriodId },
        });
        return { id: serviceId };
      });
    },

    async listRoles() {
      return database.select().from(roles).orderBy(asc(roles.name));
    },

    async createRole(input: CreateRoleInput, actorUserId: string) {
      return database.transaction(async (transaction) => {
        const [existing] = await transaction
          .select({ id: roles.id })
          .from(roles)
          .where(eq(roles.slug, input.slug))
          .limit(1);
        if (existing) {
          throw new ApiError("role_slug_already_exists", 409, "A role with this slug already exists");
        }
        const [role] = await transaction
          .insert(roles)
          .values({
            slug: input.slug,
            name: input.name,
            description: input.description ?? null,
          })
          .returning({
            id: roles.id,
            slug: roles.slug,
            name: roles.name,
            description: roles.description,
          });
        await transaction.insert(auditEvents).values({
          actorUserId,
          action: "role.created",
          entityType: "role",
          entityId: role.id,
          metadata: { slug: input.slug },
        });
        return role;
      });
    },

    async updateDisplayName(userId: string, displayName: string, actorUserId: string) {
      return database.transaction(async (transaction) => {
        const [user] = await transaction
          .update(users)
          .set({ displayName, updatedAt: new Date() })
          .where(eq(users.id, userId))
          .returning({ id: users.id, displayName: users.displayName });
        if (!user) throw new ApiError("user_not_found", 404, "User not found");
        await transaction.insert(auditEvents).values({
          actorUserId,
          action: "user.display_name_updated",
          entityType: "user",
          entityId: userId,
          metadata: {},
        });
        return user;
      });
    },

    async createPendingUser(input: PendingUserInput, actorUserId: string) {
      return database.transaction(async (transaction) => {
        const [existing] = await transaction
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, input.email))
          .limit(1);
        if (existing) {
          throw new ApiError("email_already_registered", 409, "A user with this email already exists");
        }
        const [user] = await transaction
          .insert(users)
          .values({
            email: input.email,
            displayName: input.displayName,
            systemRole: input.systemRole,
          })
          .returning({
            id: users.id,
            email: users.email,
            displayName: users.displayName,
            systemRole: users.systemRole,
          });
        await transaction.insert(auditEvents).values({
          actorUserId,
          action: "user.pre_provisioned",
          entityType: "user",
          entityId: user.id,
          metadata: { email: input.email, systemRole: input.systemRole },
        });
        return user;
      });
    },

    async getMemberRoles(userId: string) {
      return database
        .select({
          roleId: userRoles.roleId,
          roleName: roles.name,
          proficiency: userRoles.proficiency,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, userId))
        .orderBy(asc(roles.name));
    },

    async listUsersWithRoles() {
      const userRows = await database
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          systemRole: users.systemRole,
          isActive: users.isActive,
        })
        .from(users)
        .orderBy(asc(users.displayName));

      const roleRows = await database
        .select({
          userId: userRoles.userId,
          roleId: userRoles.roleId,
          roleName: roles.name,
          proficiency: userRoles.proficiency,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id));

      const rolesByUser = new Map<string, UserWithRoles["roles"][number][]>();
      for (const row of roleRows) {
        const list = rolesByUser.get(row.userId) ?? [];
        list.push({ roleId: row.roleId, roleName: row.roleName, proficiency: row.proficiency });
        rolesByUser.set(row.userId, list);
      }

      return userRows.map((user) => ({ ...user, roles: rolesByUser.get(user.id) ?? [] }));
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
          openReplacementRequestId: replacementRequests.id,
          songsPrintingLink: services.songsPrintingLink,
        })
        .from(assignments)
        .innerJoin(rosterCandidates, eq(assignments.candidateId, rosterCandidates.id))
        .innerJoin(services, eq(assignments.serviceId, services.id))
        .innerJoin(roles, eq(assignments.roleId, roles.id))
        .leftJoin(
          replacementRequests,
          and(eq(replacementRequests.assignmentId, assignments.id), eq(replacementRequests.status, "open")),
        )
        .where(and(...conditions))
        .orderBy(asc(services.startsAt));
    },

    async listServiceTeammates(serviceIds: ReadonlyArray<string>) {
      if (serviceIds.length === 0) return [];
      return database
        .select({
          serviceId: assignments.serviceId,
          userId: users.id,
          displayName: users.displayName,
          roleName: roles.name,
        })
        .from(assignments)
        .innerJoin(rosterCandidates, eq(assignments.candidateId, rosterCandidates.id))
        .innerJoin(users, eq(assignments.userId, users.id))
        .innerJoin(roles, eq(assignments.roleId, roles.id))
        .where(and(inArray(assignments.serviceId, serviceIds), eq(rosterCandidates.status, "published")))
        .orderBy(asc(roles.name), asc(users.displayName));
    },

    async listServiceSongs(serviceIds: ReadonlyArray<string>) {
      if (serviceIds.length === 0) return [];
      const rows = await database
        .select({
          serviceId: serviceSongs.serviceId,
          id: serviceSongs.id,
          title: serviceSongs.title,
          youtubeLink: serviceSongs.youtubeLink,
          order: serviceSongs.sortOrder,
        })
        .from(serviceSongs)
        .where(inArray(serviceSongs.serviceId, serviceIds))
        .orderBy(asc(serviceSongs.sortOrder));
      return rows;
    },

    async replaceServiceSongs(serviceId: string, input: ServiceSongsInput, actorUserId: string) {
      return database.transaction(async (transaction) => {
        const [existing] = await transaction
          .select({ id: services.id })
          .from(services)
          .where(eq(services.id, serviceId))
          .limit(1);
        if (!existing) throw new ApiError("service_not_found", 404, "Service not found");

        await transaction.delete(serviceSongs).where(eq(serviceSongs.serviceId, serviceId));

        const songs: ServiceSong[] =
          input.songs.length === 0
            ? []
            : await transaction
                .insert(serviceSongs)
                .values(
                  input.songs.map((song, index) => ({
                    serviceId,
                    title: song.title,
                    youtubeLink: song.youtubeLink ?? null,
                    sortOrder: index + 1,
                  })),
                )
                .returning({
                  id: serviceSongs.id,
                  title: serviceSongs.title,
                  youtubeLink: serviceSongs.youtubeLink,
                  order: serviceSongs.sortOrder,
                })
                .then((rows) => rows.sort((left, right) => left.order - right.order));

        const [service] = await transaction
          .update(services)
          .set({ songsPrintingLink: input.songsPrintingLink ?? null })
          .where(eq(services.id, serviceId))
          .returning({ songsPrintingLink: services.songsPrintingLink });

        await transaction.insert(auditEvents).values({
          actorUserId,
          action: "service.songs_updated",
          entityType: "service",
          entityId: serviceId,
          metadata: { songCount: songs.length },
        });

        return { songs, songsPrintingLink: service.songsPrintingLink };
      });
    },

    async listEligibleUsersForServiceRole(serviceId: string, roleId: string) {
      return database
        .select({
          userId: users.id,
          displayName: users.displayName,
          email: users.email,
          proficiency: userRoles.proficiency,
        })
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
          userEmail: users.email,
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

    async reassignAssignment(
      candidateId: string,
      assignmentId: string,
      userId: string,
      isLocked: boolean,
      actorUserId: string,
    ) {
      return database.transaction(async (transaction) => {
        const [record] = await transaction
          .select({ id: assignments.id, status: rosterCandidates.status, serviceId: assignments.serviceId })
          .from(assignments)
          .innerJoin(rosterCandidates, eq(assignments.candidateId, rosterCandidates.id))
          .where(and(eq(assignments.id, assignmentId), eq(assignments.candidateId, candidateId)))
          .limit(1);
        if (!record) throw new ApiError("assignment_not_found", 404, "Assignment not found");
        if (record.status !== "draft") {
          throw new ApiError(
            "candidate_not_editable",
            409,
            "Only a draft candidate's assignments can be reassigned",
          );
        }
        const [conflict] = await transaction
          .select({ id: assignments.id })
          .from(assignments)
          .where(
            and(
              eq(assignments.candidateId, candidateId),
              eq(assignments.serviceId, record.serviceId),
              eq(assignments.userId, userId),
              ne(assignments.id, assignmentId),
            ),
          )
          .limit(1);
        if (conflict) {
          throw new ApiError(
            "assignment_conflict",
            409,
            "This volunteer is already assigned to another role for this service",
          );
        }
        const [updated] = await transaction
          .update(assignments)
          .set({ userId, source: "manual", isLocked, updatedAt: new Date() })
          .where(eq(assignments.id, assignmentId))
          .returning({
            id: assignments.id,
            userId: assignments.userId,
            isLocked: assignments.isLocked,
            source: assignments.source,
          });
        await transaction.insert(auditEvents).values({
          actorUserId,
          action: "assignment.reassigned",
          entityType: "assignment",
          entityId: assignmentId,
          metadata: { candidateId, userId, isLocked },
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

    async getOrCreateNotifications(entries: ReadonlyArray<PendingNotificationInput>) {
      if (entries.length === 0) return [];
      return database.transaction(async (transaction) => {
        await transaction
          .insert(notificationDeliveries)
          .values(
            entries.map((entry) => ({
              userId: entry.userId,
              recipientEmail: entry.recipientEmail,
              eventType: entry.eventType,
              idempotencyKey: entry.idempotencyKey,
            })),
          )
          .onConflictDoNothing({ target: notificationDeliveries.idempotencyKey });

        return transaction
          .select({
            id: notificationDeliveries.id,
            userId: notificationDeliveries.userId,
            recipientEmail: notificationDeliveries.recipientEmail,
            eventType: notificationDeliveries.eventType,
            idempotencyKey: notificationDeliveries.idempotencyKey,
            status: notificationDeliveries.status,
          })
          .from(notificationDeliveries)
          .where(
            and(
              inArray(
                notificationDeliveries.idempotencyKey,
                entries.map((entry) => entry.idempotencyKey),
              ),
              ne(notificationDeliveries.status, "sent"),
            ),
          );
      });
    },

    async markNotificationSent(notificationId: string, providerMessageId: string) {
      await database
        .update(notificationDeliveries)
        .set({
          status: "sent",
          providerMessageId,
          sentAt: new Date(),
          attemptCount: sql`${notificationDeliveries.attemptCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(notificationDeliveries.id, notificationId));
    },

    async markNotificationFailed(notificationId: string, error: string) {
      await database
        .update(notificationDeliveries)
        .set({
          status: "failed",
          lastError: error,
          attemptCount: sql`${notificationDeliveries.attemptCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(notificationDeliveries.id, notificationId));
    },

    async createReplacementRequest(assignmentId: string, requesterId: string, reason: string | null) {
      const insertedId = await database.transaction(async (transaction) => {
        const [assignmentRow] = await transaction
          .select({ id: assignments.id, userId: assignments.userId, status: rosterCandidates.status })
          .from(assignments)
          .innerJoin(rosterCandidates, eq(assignments.candidateId, rosterCandidates.id))
          .where(eq(assignments.id, assignmentId))
          .limit(1);
        if (!assignmentRow) throw new ApiError("assignment_not_found", 404, "Assignment not found");
        if (assignmentRow.status !== "published") {
          throw new ApiError(
            "assignment_not_published",
            409,
            "Only an assignment on a published roster can request a replacement",
          );
        }
        if (assignmentRow.userId !== requesterId) {
          throw new ApiError(
            "not_your_assignment",
            403,
            "You can only request a replacement for your own assignment",
          );
        }

        const [existingOpen] = await transaction
          .select({ id: replacementRequests.id })
          .from(replacementRequests)
          .where(
            and(eq(replacementRequests.assignmentId, assignmentId), eq(replacementRequests.status, "open")),
          )
          .limit(1);
        if (existingOpen) {
          throw new ApiError(
            "replacement_request_already_open",
            409,
            "There is already an open replacement request for this assignment",
          );
        }

        const [inserted] = await transaction
          .insert(replacementRequests)
          .values({ assignmentId, requesterId, reason })
          .returning({ id: replacementRequests.id });
        await transaction.insert(auditEvents).values({
          actorUserId: requesterId,
          action: "replacement_request.created",
          entityType: "replacement_request",
          entityId: inserted.id,
          metadata: { assignmentId },
        });
        return inserted.id;
      });

      const summary = await repository.getReplacementRequestDetail(insertedId);
      if (!summary) throw new ApiError("replacement_request_not_found", 404, "Replacement request not found");
      return summary;
    },

    async listReplacementRequests() {
      return replacementRequestsBaseQuery().orderBy(desc(replacementRequests.createdAt));
    },

    async listMyReplacementRequests(requesterId: string) {
      return replacementRequestsBaseQuery()
        .where(eq(replacementRequests.requesterId, requesterId))
        .orderBy(desc(replacementRequests.createdAt));
    },

    async getReplacementRequestDetail(requestId: string) {
      const [summary] = await replacementRequestsBaseQuery()
        .where(eq(replacementRequests.id, requestId))
        .limit(1);
      return summary ?? null;
    },

    async getEligibleReplacementsForRequest(requestId: string) {
      const [row] = await database
        .select({
          serviceId: assignments.serviceId,
          roleId: assignments.roleId,
          requesterId: replacementRequests.requesterId,
        })
        .from(replacementRequests)
        .innerJoin(assignments, eq(replacementRequests.assignmentId, assignments.id))
        .where(eq(replacementRequests.id, requestId))
        .limit(1);
      if (!row) throw new ApiError("replacement_request_not_found", 404, "Replacement request not found");
      const eligible = await repository.listEligibleUsersForServiceRole(row.serviceId, row.roleId);
      return eligible.filter((candidate) => candidate.userId !== row.requesterId);
    },

    async approveReplacementRequest(requestId: string, replacementUserId: string, reviewerId: string) {
      await database.transaction(async (transaction) => {
        const [requestRow] = await transaction
          .select({
            id: replacementRequests.id,
            status: replacementRequests.status,
            assignmentId: replacementRequests.assignmentId,
          })
          .from(replacementRequests)
          .where(eq(replacementRequests.id, requestId))
          .limit(1);
        if (!requestRow) throw new ApiError("replacement_request_not_found", 404, "Replacement request not found");
        if (requestRow.status !== "open") {
          throw new ApiError("replacement_request_not_open", 409, "This replacement request is no longer open");
        }

        const [assignmentRow] = await transaction
          .select({
            serviceId: assignments.serviceId,
            candidateId: assignments.candidateId,
            roleId: assignments.roleId,
          })
          .from(assignments)
          .where(eq(assignments.id, requestRow.assignmentId))
          .limit(1);
        if (!assignmentRow) throw new ApiError("assignment_not_found", 404, "Assignment not found");

        const [eligibleReplacement] = await transaction
          .select({ userId: users.id })
          .from(userRoles)
          .innerJoin(users, eq(userRoles.userId, users.id))
          .innerJoin(services, eq(services.id, assignmentRow.serviceId))
          .leftJoin(
            availability,
            and(
              eq(availability.userId, users.id),
              sql`${availability.serviceDate} = (${services.startsAt} AT TIME ZONE 'Asia/Singapore')::date`,
            ),
          )
          .where(
            and(
              eq(userRoles.roleId, assignmentRow.roleId),
              eq(users.id, replacementUserId),
              eq(users.isActive, true),
              or(isNull(availability.status), ne(availability.status, "unavailable")),
            ),
          )
          .limit(1);
        if (!eligibleReplacement) {
          throw new ApiError("ineligible_assignee", 400, "This volunteer is not eligible for this role");
        }

        const [conflict] = await transaction
          .select({ id: assignments.id })
          .from(assignments)
          .where(
            and(
              eq(assignments.candidateId, assignmentRow.candidateId),
              eq(assignments.serviceId, assignmentRow.serviceId),
              eq(assignments.userId, replacementUserId),
              ne(assignments.id, requestRow.assignmentId),
            ),
          )
          .limit(1);
        if (conflict) {
          throw new ApiError(
            "assignment_conflict",
            409,
            "This volunteer is already assigned to another role for this service",
          );
        }

        await transaction
          .update(assignments)
          .set({ userId: replacementUserId, source: "manual", updatedAt: new Date() })
          .where(eq(assignments.id, requestRow.assignmentId));
        await transaction
          .update(replacementRequests)
          .set({
            status: "approved",
            replacementUserId,
            reviewedBy: reviewerId,
            updatedAt: new Date(),
          })
          .where(eq(replacementRequests.id, requestId));
        await transaction.insert(auditEvents).values({
          actorUserId: reviewerId,
          action: "replacement_request.approved",
          entityType: "replacement_request",
          entityId: requestId,
          metadata: { replacementUserId },
        });
      });

      const summary = await repository.getReplacementRequestDetail(requestId);
      if (!summary) throw new ApiError("replacement_request_not_found", 404, "Replacement request not found");
      return summary;
    },

    async declineReplacementRequest(requestId: string, reviewerId: string) {
      await database.transaction(async (transaction) => {
        const [requestRow] = await transaction
          .select({ id: replacementRequests.id, status: replacementRequests.status })
          .from(replacementRequests)
          .where(eq(replacementRequests.id, requestId))
          .limit(1);
        if (!requestRow) throw new ApiError("replacement_request_not_found", 404, "Replacement request not found");
        if (requestRow.status !== "open") {
          throw new ApiError("replacement_request_not_open", 409, "This replacement request is no longer open");
        }

        await transaction
          .update(replacementRequests)
          .set({ status: "declined", reviewedBy: reviewerId, updatedAt: new Date() })
          .where(eq(replacementRequests.id, requestId));
        await transaction.insert(auditEvents).values({
          actorUserId: reviewerId,
          action: "replacement_request.declined",
          entityType: "replacement_request",
          entityId: requestId,
          metadata: {},
        });
      });

      const summary = await repository.getReplacementRequestDetail(requestId);
      if (!summary) throw new ApiError("replacement_request_not_found", 404, "Replacement request not found");
      return summary;
    },

    async cancelReplacementRequest(requestId: string, requesterId: string) {
      await database.transaction(async (transaction) => {
        const [requestRow] = await transaction
          .select({
            id: replacementRequests.id,
            status: replacementRequests.status,
            requesterId: replacementRequests.requesterId,
          })
          .from(replacementRequests)
          .where(eq(replacementRequests.id, requestId))
          .limit(1);
        if (!requestRow) throw new ApiError("replacement_request_not_found", 404, "Replacement request not found");
        if (requestRow.requesterId !== requesterId) {
          throw new ApiError(
            "not_your_replacement_request",
            403,
            "You can only cancel your own replacement request",
          );
        }
        if (requestRow.status !== "open") {
          throw new ApiError("replacement_request_not_open", 409, "This replacement request is no longer open");
        }

        await transaction
          .update(replacementRequests)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(replacementRequests.id, requestId));
        await transaction.insert(auditEvents).values({
          actorUserId: requesterId,
          action: "replacement_request.cancelled",
          entityType: "replacement_request",
          entityId: requestId,
          metadata: {},
        });
      });

      const summary = await repository.getReplacementRequestDetail(requestId);
      if (!summary) throw new ApiError("replacement_request_not_found", 404, "Replacement request not found");
      return summary;
    },
  };

  return repository;
}
