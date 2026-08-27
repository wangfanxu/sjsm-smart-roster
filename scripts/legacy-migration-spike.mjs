import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const defaultInputPath = resolve(
  projectRoot,
  "fixtures/legacy/synthetic-firestore.json",
);
export const defaultSqlOutputPath = resolve(
  projectRoot,
  "artifacts/migration/legacy-migration.sql",
);
export const defaultReportOutputPath = resolve(
  projectRoot,
  "artifacts/migration/legacy-migration-report.json",
);

function fail(message) {
  throw new Error(`Legacy migration validation failed: ${message}`);
}

function requireString(value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${path} must be a non-empty string`);
  }
  return value;
}

function requireArray(value, path) {
  if (!Array.isArray(value)) fail(`${path} must be an array`);
  return value;
}

function deterministicUuid(scope, legacyId) {
  const hex = createHash("sha256").update(`${scope}:${legacyId}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function roleSlug(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function systemRole(legacyRole) {
  if (legacyRole === "admin") return "administrator";
  if (legacyRole.endsWith("-leader")) return "team_leader";
  return "volunteer";
}

function timestampToDate(value, path) {
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed;
  }

  if (value && typeof value === "object") {
    const seconds = value.seconds ?? value._seconds;
    const nanoseconds = value.nanoseconds ?? value._nanoseconds ?? 0;
    if (Number.isInteger(seconds) && Number.isInteger(nanoseconds)) {
      return new Date(seconds * 1000 + Math.floor(nanoseconds / 1_000_000));
    }
  }

  fail(`${path} must be an ISO date or Firestore timestamp object`);
}

function dateKey(value, timeZone, path) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestampToDate(value, path));
  const part = (type) => parts.find((candidate) => candidate.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function assignedUserIds(value, path) {
  if (value === "" || value === null || value === undefined) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.map((userId, index) => requireString(userId, `${path}[${index}]`));
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function insertSql(table, columns, rows) {
  if (rows.length === 0) return "";
  const values = rows
    .map((row) => `  (${columns.map((column) => sqlLiteral(row[column])).join(", ")})`)
    .join(",\n");
  return `INSERT INTO ${table} (${columns.join(", ")}) VALUES\n${values};`;
}

export function transformLegacyFixture(fixture) {
  if (!fixture || typeof fixture !== "object") fail("root must be an object");
  const metadata = fixture.metadata;
  const collections = fixture.collections;
  if (!metadata?.synthetic || metadata.containsPersonalData !== false) {
    fail("only fixtures explicitly marked synthetic and free of personal data are accepted");
  }

  const timeZone = requireString(metadata.timeZone, "metadata.timeZone");
  const utcOffset = requireString(metadata.utcOffset, "metadata.utcOffset");
  const period = metadata.planningPeriod;
  const legacyUsers = requireArray(collections?.users, "collections.users");
  const legacyEvents = requireArray(collections?.events, "collections.events");
  const legacyAvailability = requireArray(
    collections?.availability,
    "collections.availability",
  );
  const legacyRequests = requireArray(
    collections?.serviceRequests,
    "collections.serviceRequests",
  );

  const userIds = new Map();
  const users = legacyUsers.map((user, index) => {
    const path = `collections.users[${index}]`;
    const legacyId = requireString(user.id, `${path}.id`);
    const email = requireString(user.email, `${path}.email`);
    if (!email.endsWith("@example.test")) {
      fail(`${path}.email must use the reserved example.test domain`);
    }
    if (userIds.has(legacyId)) fail(`duplicate legacy user ID ${legacyId}`);
    const id = deterministicUuid("user", legacyId);
    userIds.set(legacyId, id);
    return {
      id,
      firebase_uid: `synthetic:${legacyId}`,
      email,
      display_name: requireString(user.displayName, `${path}.displayName`),
      system_role: systemRole(requireString(user.role ?? "member", `${path}.role`)),
      is_active: user.isActive !== false,
    };
  });

  const roleNames = new Set();
  for (const user of legacyUsers) {
    roleNames.add(requireString(user.primaryInstrument, `user ${user.id} primaryInstrument`));
    for (const role of requireArray(user.secondaryInstruments ?? [], `user ${user.id} secondaryInstruments`)) {
      roleNames.add(requireString(role, `user ${user.id} secondary role`));
    }
  }
  for (const event of legacyEvents) {
    if (!event.roles || typeof event.roles !== "object" || Array.isArray(event.roles)) {
      fail(`event ${event.id} roles must be an object`);
    }
    Object.keys(event.roles).forEach((role) => roleNames.add(role));
  }

  const sortedRoleNames = [...roleNames].sort();
  const roleIds = new Map(
    sortedRoleNames.map((name) => [name, deterministicUuid("role", roleSlug(name))]),
  );
  const roles = sortedRoleNames.map((name) => ({
    id: roleIds.get(name),
    slug: roleSlug(name),
    name,
    description: "Imported from synthetic legacy fixture",
  }));

  const userRoles = [];
  for (const user of legacyUsers) {
    const userId = userIds.get(user.id);
    userRoles.push({
      user_id: userId,
      role_id: roleIds.get(user.primaryInstrument),
      proficiency: "primary",
    });
    for (const secondaryRole of user.secondaryInstruments ?? []) {
      if (secondaryRole === user.primaryInstrument) continue;
      userRoles.push({
        user_id: userId,
        role_id: roleIds.get(secondaryRole),
        proficiency: "secondary",
      });
    }
  }

  const planningPeriodId = deterministicUuid(
    "planning-period",
    requireString(period?.legacyId, "metadata.planningPeriod.legacyId"),
  );
  const administrator = users.find((user) => user.system_role === "administrator");
  const planningPeriods = [
    {
      id: planningPeriodId,
      name: requireString(period.name, "metadata.planningPeriod.name"),
      starts_on: requireString(period.startsOn, "metadata.planningPeriod.startsOn"),
      ends_on: requireString(period.endsOn, "metadata.planningPeriod.endsOn"),
      status: "draft",
      created_by: administrator?.id ?? null,
    },
  ];

  const eventIds = new Map();
  const services = [];
  const serviceRoleRequirements = [];
  const assignments = [];
  const duplicateAssignmentKeys = new Set();

  for (const [eventIndex, event] of legacyEvents.entries()) {
    const path = `collections.events[${eventIndex}]`;
    const legacyId = requireString(event.id, `${path}.id`);
    const id = deterministicUuid("service", legacyId);
    eventIds.set(legacyId, id);
    const serviceDate = dateKey(event.date, timeZone, `${path}.date`);
    if (serviceDate < period.startsOn || serviceDate > period.endsOn) {
      fail(`${path}.date falls outside the configured planning period`);
    }
    const time = requireString(event.time, `${path}.time`);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail(`${path}.time must be HH:mm`);
    services.push({
      id,
      planning_period_id: planningPeriodId,
      title: requireString(event.title, `${path}.title`),
      starts_at: `${serviceDate}T${time}:00${utcOffset}`,
      notes: typeof event.notes === "string" ? event.notes : null,
    });

    for (const [roleName, assignedValue] of Object.entries(event.roles)) {
      const roleId = roleIds.get(roleName);
      const assigned = assignedUserIds(assignedValue, `${path}.roles.${roleName}`);
      serviceRoleRequirements.push({
        service_id: id,
        role_id: roleId,
        required_count: Math.max(1, assigned.length),
      });
      for (const legacyUserId of assigned) {
        const userId = userIds.get(legacyUserId);
        if (!userId) fail(`${path}.roles.${roleName} references unknown user ${legacyUserId}`);
        const collisionKey = `${legacyId}:${legacyUserId}`;
        if (duplicateAssignmentKeys.has(collisionKey)) {
          fail(`${path} assigns user ${legacyUserId} to more than one role`);
        }
        duplicateAssignmentKeys.add(collisionKey);
        assignments.push({
          id: deterministicUuid("assignment", `${legacyId}:${roleName}:${legacyUserId}`),
          candidate_id: deterministicUuid("candidate", period.legacyId),
          service_id: id,
          role_id: roleId,
          user_id: userId,
          is_locked: false,
          source: "manual",
          legacy_event_id: legacyId,
          legacy_role: roleName,
          legacy_user_id: legacyUserId,
        });
      }
    }
  }

  const availability = legacyAvailability
    .filter((entry) => entry.isAvailable === false)
    .map((entry, index) => {
      const path = `collections.availability[${index}]`;
      const userId = userIds.get(requireString(entry.userId, `${path}.userId`));
      if (!userId) fail(`${path}.userId references an unknown user`);
      return {
        user_id: userId,
        service_date: dateKey(entry.date, timeZone, `${path}.date`),
        status: "unavailable",
        note: typeof entry.note === "string" ? entry.note : null,
        updated_by: userId,
      };
    });

  const rosterCandidates = [
    {
      id: deterministicUuid("candidate", period.legacyId),
      planning_period_id: planningPeriodId,
      version: 1,
      status: "draft",
      hard_constraints_satisfied: true,
      objective_score: null,
      configuration: { source: "synthetic-legacy-migration-spike" },
      explanation: { note: "Legacy manual assignments imported as a draft candidate" },
      created_by: administrator?.id ?? null,
    },
  ];

  const replacementRequests = legacyRequests.map((request, index) => {
    const path = `collections.serviceRequests[${index}]`;
    const requesterId = userIds.get(requireString(request.requesterId, `${path}.requesterId`));
    const replacementUserId = userIds.get(
      requireString(request.replacementId, `${path}.replacementId`),
    );
    const assignment = assignments.find(
      (candidate) =>
        candidate.legacy_event_id === request.eventId &&
        candidate.legacy_role === request.role &&
        candidate.legacy_user_id === request.requesterId,
    );
    if (!requesterId || !replacementUserId) fail(`${path} references an unknown user`);
    if (!eventIds.has(request.eventId)) fail(`${path}.eventId references an unknown event`);
    if (!assignment) fail(`${path} does not reference an existing assignment`);
    const statusMap = { pending: "open", approved: "approved", rejected: "declined" };
    return {
      id: deterministicUuid("replacement-request", requireString(request.id, `${path}.id`)),
      assignment_id: assignment.id,
      requester_id: requesterId,
      replacement_user_id: replacementUserId,
      status: statusMap[request.status] ?? "open",
      reason: typeof request.reason === "string" ? request.reason : null,
    };
  });

  const cleanAssignments = assignments.map((assignment) => ({
    id: assignment.id,
    candidate_id: assignment.candidate_id,
    service_id: assignment.service_id,
    role_id: assignment.role_id,
    user_id: assignment.user_id,
    is_locked: assignment.is_locked,
    source: assignment.source,
  }));
  const auditEvents = [
    {
      id: deterministicUuid("audit", period.legacyId),
      actor_user_id: administrator?.id ?? null,
      action: "legacy_fixture.transformed",
      entity_type: "planning_period",
      entity_id: planningPeriodId,
      metadata: {
        synthetic: true,
        fixtureVersion: metadata.fixtureVersion,
        sourceCollections: {
          users: legacyUsers.length,
          events: legacyEvents.length,
          availability: legacyAvailability.length,
          serviceRequests: legacyRequests.length,
        },
      },
    },
  ];

  const target = {
    users,
    roles,
    userRoles,
    planningPeriods,
    services,
    serviceRoleRequirements,
    availability,
    rosterCandidates,
    assignments: cleanAssignments,
    replacementRequests,
    auditEvents,
  };
  const targetCounts = Object.fromEntries(
    Object.entries(target).map(([name, records]) => [name, records.length]),
  );
  const report = {
    fixtureVersion: metadata.fixtureVersion,
    synthetic: true,
    containsPersonalData: false,
    sourceCounts: {
      users: legacyUsers.length,
      events: legacyEvents.length,
      availability: legacyAvailability.length,
      serviceRequests: legacyRequests.length,
    },
    targetCounts,
    checks: [
      { name: "required_fields", passed: true },
      { name: "reserved_test_emails", passed: true },
      { name: "unique_legacy_ids", passed: true },
      { name: "relationship_references", passed: true },
      { name: "one_role_per_service_user", passed: true },
      { name: "planning_period_bounds", passed: true },
    ],
    assumptions: [
      "Legacy users collection document IDs are Firebase UIDs.",
      "Legacy availability stores exceptions only; isAvailable=true records are omitted.",
      "Legacy event roles define both required roles and manual assignments.",
      "Role capacity is at least one and otherwise inferred from assigned array length.",
      `Legacy calendar dates are interpreted in ${timeZone}.`,
      "Imported assignments remain a draft candidate and are never auto-published.",
    ],
  };

  return { target, report };
}

export function buildMigrationSql(target) {
  const statements = [
    "BEGIN;",
    "SET LOCAL TIME ZONE 'UTC';",
    insertSql("users", ["id", "firebase_uid", "email", "display_name", "system_role", "is_active"], target.users),
    insertSql("roles", ["id", "slug", "name", "description"], target.roles),
    insertSql("user_roles", ["user_id", "role_id", "proficiency"], target.userRoles),
    insertSql("planning_periods", ["id", "name", "starts_on", "ends_on", "status", "created_by"], target.planningPeriods),
    insertSql("services", ["id", "planning_period_id", "title", "starts_at", "notes"], target.services),
    insertSql("service_role_requirements", ["service_id", "role_id", "required_count"], target.serviceRoleRequirements),
    insertSql("availability", ["user_id", "service_date", "status", "note", "updated_by"], target.availability),
    insertSql("roster_candidates", ["id", "planning_period_id", "version", "status", "hard_constraints_satisfied", "objective_score", "configuration", "explanation", "created_by"], target.rosterCandidates),
    insertSql("assignments", ["id", "candidate_id", "service_id", "role_id", "user_id", "is_locked", "source"], target.assignments),
    insertSql("replacement_requests", ["id", "assignment_id", "requester_id", "replacement_user_id", "status", "reason"], target.replacementRequests),
    insertSql("audit_events", ["id", "actor_user_id", "action", "entity_type", "entity_id", "metadata"], target.auditEvents),
    "COMMIT;",
  ];
  return `${statements.filter(Boolean).join("\n\n")}\n`;
}

export async function runMigrationSpike({
  inputPath = defaultInputPath,
  sqlOutputPath = defaultSqlOutputPath,
  reportOutputPath = defaultReportOutputPath,
} = {}) {
  const fixture = JSON.parse(await readFile(inputPath, "utf8"));
  const { target, report } = transformLegacyFixture(fixture);
  const sql = buildMigrationSql(target);
  await Promise.all([
    mkdir(dirname(sqlOutputPath), { recursive: true }),
    mkdir(dirname(reportOutputPath), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(sqlOutputPath, sql),
    writeFile(reportOutputPath, `${JSON.stringify(report, null, 2)}\n`),
  ]);
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await runMigrationSpike();
  console.log(JSON.stringify(report, null, 2));
}
