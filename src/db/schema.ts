import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const systemRole = pgEnum("system_role", [
  "volunteer",
  "team_leader",
  "administrator",
]);
export const roleProficiency = pgEnum("role_proficiency", ["primary", "secondary"]);
export const planningPeriodStatus = pgEnum("planning_period_status", [
  "draft",
  "active",
  "archived",
]);
export const availabilityStatus = pgEnum("availability_status", [
  "available",
  "unavailable",
  "preferred",
]);
export const candidateStatus = pgEnum("candidate_status", [
  "draft",
  "published",
  "superseded",
]);
export const assignmentSource = pgEnum("assignment_source", ["solver", "manual"]);
export const replacementStatus = pgEnum("replacement_status", [
  "open",
  "approved",
  "declined",
  "cancelled",
]);
export const notificationChannel = pgEnum("notification_channel", ["email"]);
export const notificationStatus = pgEnum("notification_status", [
  "pending",
  "sent",
  "failed",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Null until the invited email signs in for the first time; see
  // UserRepository.linkPendingUserByEmail.
  firebaseUid: text("firebase_uid").unique(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  systemRole: systemRole("system_role").default("volunteer").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  ...timestamps,
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    proficiency: roleProficiency("proficiency").default("secondary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
);

export const planningPeriods = pgTable(
  "planning_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    status: planningPeriodStatus("status").default("draft").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    check("planning_period_valid_dates", sql`${table.startsOn} <= ${table.endsOn}`),
  ],
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planningPeriodId: uuid("planning_period_id")
      .notNull()
      .references(() => planningPeriods.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    notes: text("notes"),
    songsPrintingLink: text("songs_printing_link"),
    ...timestamps,
  },
  (table) => [
    unique("service_period_start_title_unique").on(
      table.planningPeriodId,
      table.startsAt,
      table.title,
    ),
  ],
);

export const serviceSongs = pgTable(
  "service_songs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    youtubeLink: text("youtube_link"),
    sortOrder: integer("sort_order").notNull(),
    ...timestamps,
  },
  (table) => [
    unique("service_song_order_unique").on(table.serviceId, table.sortOrder),
    check("service_song_order_positive", sql`${table.sortOrder} > 0`),
  ],
);

export const serviceRoleRequirements = pgTable(
  "service_role_requirements",
  {
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    requiredCount: integer("required_count").default(1).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.serviceId, table.roleId] }),
    check("service_role_required_count_positive", sql`${table.requiredCount} > 0`),
  ],
);

export const availability = pgTable(
  "availability",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serviceDate: date("service_date", { mode: "string" }).notNull(),
    status: availabilityStatus("status").notNull(),
    note: text("note"),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.userId, table.serviceDate] })],
);

export const schedulingConstraints = pgTable(
  "scheduling_constraints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planningPeriodId: uuid("planning_period_id").references(() => planningPeriods.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    isHard: boolean("is_hard").default(false).notNull(),
    weight: integer("weight").default(0).notNull(),
    configuration: jsonb("configuration")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("constraint_period_key_unique").on(table.planningPeriodId, table.key),
    check("constraint_weight_nonnegative", sql`${table.weight} >= 0`),
  ],
);

export const rosterCandidates = pgTable(
  "roster_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planningPeriodId: uuid("planning_period_id")
      .notNull()
      .references(() => planningPeriods.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: candidateStatus("status").default("draft").notNull(),
    hardConstraintsSatisfied: boolean("hard_constraints_satisfied").notNull(),
    objectiveScore: numeric("objective_score", { precision: 12, scale: 4 }),
    configuration: jsonb("configuration")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    explanation: jsonb("explanation")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("candidate_period_version_unique").on(table.planningPeriodId, table.version),
    uniqueIndex("one_published_candidate_per_period")
      .on(table.planningPeriodId)
      .where(sql`${table.status} = 'published'`),
    check("candidate_version_positive", sql`${table.version} > 0`),
    check(
      "published_candidate_satisfies_hard_constraints",
      sql`${table.status} <> 'published' OR ${table.hardConstraintsSatisfied}`,
    ),
  ],
);

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => rosterCandidates.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    isLocked: boolean("is_locked").default(false).notNull(),
    source: assignmentSource("source").default("solver").notNull(),
    ...timestamps,
  },
  (table) => [
    unique("assignment_exact_unique").on(
      table.candidateId,
      table.serviceId,
      table.roleId,
      table.userId,
    ),
    unique("assignment_one_role_per_service_user").on(
      table.candidateId,
      table.serviceId,
      table.userId,
    ),
  ],
);

export const replacementRequests = pgTable("replacement_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  assignmentId: uuid("assignment_id")
    .notNull()
    .references(() => assignments.id, { onDelete: "cascade" }),
  requesterId: uuid("requester_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  replacementUserId: uuid("replacement_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  status: replacementStatus("status").default("open").notNull(),
  reason: text("reason"),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignmentId: uuid("assignment_id").references(() => assignments.id, {
      onDelete: "set null",
    }),
    eventType: text("event_type").notNull(),
    channel: notificationChannel("channel").default("email").notNull(),
    recipientEmail: text("recipient_email").notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    status: notificationStatus("status").default("pending").notNull(),
    providerMessageId: text("provider_message_id"),
    attemptCount: integer("attempt_count").default(0).notNull(),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    check("notification_attempt_count_nonnegative", sql`${table.attemptCount} >= 0`),
  ],
);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .default(sql`'{}'::jsonb`)
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
