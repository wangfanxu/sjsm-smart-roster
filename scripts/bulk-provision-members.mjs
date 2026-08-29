import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function roleSlug(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function mapSystemRole(legacyRole) {
  const value = String(legacyRole ?? "").trim().toLowerCase();
  if (value === "admin") return "administrator";
  if (value.endsWith("-leader")) return "team_leader";
  return "volunteer";
}

/**
 * Validates and shapes one export row. Never returns the raw row on
 * failure - only its position and a reason code - so a caller can log
 * failures without ever printing an email or name.
 */
export function normalizeRow(row, index) {
  const email = typeof row?.email === "string" ? row.email.trim().toLowerCase() : "";
  if (!email) return { ok: false, index, reason: "missing_email" };
  if (!emailPattern.test(email)) return { ok: false, index, reason: "malformed_email" };

  const displayName = typeof row?.displayName === "string" ? row.displayName.trim() : "";
  if (!displayName) return { ok: false, index, reason: "missing_display_name" };

  const instruments = [
    ...(typeof row?.primaryInstrument === "string" && row.primaryInstrument.trim()
      ? [{ name: row.primaryInstrument, proficiency: "primary" }]
      : []),
    ...(Array.isArray(row?.secondaryInstruments)
      ? row.secondaryInstruments
          .filter((value) => typeof value === "string" && value.trim())
          .map((name) => ({ name, proficiency: "secondary" }))
      : []),
  ];

  const capabilitiesBySlug = new Map();
  for (const instrument of instruments) {
    const slug = roleSlug(instrument.name);
    if (!slug) continue;
    const existing = capabilitiesBySlug.get(slug);
    if (existing?.proficiency === "primary") continue;
    capabilitiesBySlug.set(slug, { slug, name: instrument.name.trim(), proficiency: instrument.proficiency });
  }

  return {
    ok: true,
    index,
    member: {
      email,
      displayName,
      systemRole: mapSystemRole(row?.role),
      capabilities: [...capabilitiesBySlug.values()],
    },
  };
}

/**
 * Splits raw export rows into unique members, invalid rows, and
 * case-insensitive email duplicates - the first occurrence of an email wins.
 */
export function partitionRows(rawRows) {
  const invalid = [];
  const duplicates = [];
  const members = [];
  const seenAtIndex = new Map();

  rawRows.forEach((row, index) => {
    const result = normalizeRow(row, index);
    if (!result.ok) {
      invalid.push(result);
      return;
    }
    const firstSeenAtIndex = seenAtIndex.get(result.member.email);
    if (firstSeenAtIndex !== undefined) {
      duplicates.push({ index, firstSeenAtIndex });
      return;
    }
    seenAtIndex.set(result.member.email, index);
    members.push(result.member);
  });

  return { members, invalid, duplicates };
}

export function collectUniqueCapabilities(members) {
  const bySlug = new Map();
  for (const member of members) {
    for (const capability of member.capabilities) {
      if (!bySlug.has(capability.slug)) {
        bySlug.set(capability.slug, { slug: capability.slug, name: capability.name });
      }
    }
  }
  return [...bySlug.values()];
}

async function apiRequest(fetchImpl, apiBaseUrl, idToken, path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("authorization", `Bearer ${idToken}`);
  if (options.body) headers.set("content-type", "application/json");
  const response = await fetchImpl(`${apiBaseUrl}/api/v1${path}`, { ...options, headers });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

/**
 * Creates any role slug referenced by the export that doesn't already
 * exist, reusing the validated POST /api/v1/roles path rather than writing
 * to the database directly.
 */
export async function ensureRoles(requiredCapabilities, { existingRoles, apiBaseUrl, idToken, fetchImpl }) {
  const roleIdBySlug = new Map(existingRoles.map((role) => [role.slug, role.id]));
  let created = 0;
  for (const capability of requiredCapabilities) {
    if (roleIdBySlug.has(capability.slug)) continue;
    const { status, body } = await apiRequest(fetchImpl, apiBaseUrl, idToken, "/roles", {
      method: "POST",
      body: JSON.stringify({ slug: capability.slug, name: capability.name }),
    });
    if (status === 201) {
      roleIdBySlug.set(capability.slug, body.role.id);
      created += 1;
    } else {
      throw new Error(`Failed to create role "${capability.slug}" (status ${status})`);
    }
  }
  return { roleIdBySlug, created };
}

/**
 * Pre-provisions one member via the same POST /api/v1/users path a manual
 * single invite already uses. An email that is already registered is an
 * expected skip, not a failure - re-running the script must stay safe.
 */
export async function provisionUser(member, { apiBaseUrl, idToken, existingUserIdByEmail, fetchImpl }) {
  const existingId = existingUserIdByEmail.get(member.email);
  if (existingId) return { status: "skipped", userId: existingId };

  const { status, body } = await apiRequest(fetchImpl, apiBaseUrl, idToken, "/users", {
    method: "POST",
    body: JSON.stringify({
      email: member.email,
      displayName: member.displayName,
      systemRole: member.systemRole,
    }),
  });
  if (status === 201) return { status: "created", userId: body.user.id };
  if (status === 409 && body?.error?.code === "email_already_registered") {
    return { status: "skipped", userId: null };
  }
  return { status: "failed", userId: null, errorCode: body?.error?.code ?? `http_${status}` };
}

export async function syncMemberRoles(userId, member, roleIdBySlug, { apiBaseUrl, idToken, fetchImpl }) {
  const capabilities = member.capabilities
    .filter((capability) => roleIdBySlug.has(capability.slug))
    .map((capability) => ({ roleId: roleIdBySlug.get(capability.slug), proficiency: capability.proficiency }));
  const { status, body } = await apiRequest(fetchImpl, apiBaseUrl, idToken, `/users/${userId}/roles`, {
    method: "PUT",
    body: JSON.stringify({ capabilities }),
  });
  if (status !== 200) throw new Error(`Failed to set role capabilities (status ${status})`);
  return body.memberRoles;
}

/**
 * Orchestrates the whole run. Only counts are ever logged - never an email
 * or display name - so this output stays safe to paste for debugging.
 */
export async function run({ exportFilePath, apiBaseUrl, idToken, fetchImpl = fetch, log = console.log }) {
  const raw = JSON.parse(await readFile(exportFilePath, "utf8"));
  if (!Array.isArray(raw)) throw new Error("Export file must contain a JSON array of member rows");

  const { members, invalid, duplicates } = partitionRows(raw);

  const [{ body: rolesBody }, { body: usersBody }] = await Promise.all([
    apiRequest(fetchImpl, apiBaseUrl, idToken, "/roles"),
    apiRequest(fetchImpl, apiBaseUrl, idToken, "/users"),
  ]);
  const existingUserIdByEmail = new Map(usersBody.users.map((user) => [user.email.toLowerCase(), user.id]));

  const { roleIdBySlug, created: rolesCreated } = await ensureRoles(collectUniqueCapabilities(members), {
    existingRoles: rolesBody.roles,
    apiBaseUrl,
    idToken,
    fetchImpl,
  });

  const tally = { created: 0, skipped: 0, failed: 0, rolesSynced: 0, rolesSyncSkipped: 0 };

  for (const member of members) {
    const result = await provisionUser(member, { apiBaseUrl, idToken, existingUserIdByEmail, fetchImpl });
    if (result.status === "created") tally.created += 1;
    else if (result.status === "skipped") tally.skipped += 1;
    else {
      tally.failed += 1;
      continue;
    }

    if (result.userId) {
      await syncMemberRoles(result.userId, member, roleIdBySlug, { apiBaseUrl, idToken, fetchImpl });
      tally.rolesSynced += 1;
    } else {
      tally.rolesSyncSkipped += 1;
    }
  }

  log("Bulk member provisioning complete.");
  log(`  Rows read:                 ${raw.length}`);
  log(`  Skipped (invalid row):     ${invalid.length}`);
  log(`  Skipped (duplicate email): ${duplicates.length}`);
  log(`  Roles created:             ${rolesCreated}`);
  log(`  Accounts created:          ${tally.created}`);
  log(`  Accounts already existed:  ${tally.skipped}`);
  log(`  Accounts failed:           ${tally.failed}`);
  log(`  Role capabilities synced:  ${tally.rolesSynced}`);
  log(`  Role sync skipped:         ${tally.rolesSyncSkipped}`);
  if (invalid.length > 0) {
    log("  Invalid rows (by position only):");
    for (const entry of invalid) log(`    row ${entry.index}: ${entry.reason}`);
  }

  return { rowCount: raw.length, invalidCount: invalid.length, duplicateCount: duplicates.length, rolesCreated, ...tally };
}

async function mintAdminIdToken({ adminEmail, firebaseApiKey, projectId, fetchImpl = fetch }) {
  const { applicationDefault, getApp, getApps, initializeApp } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");

  const app =
    getApps().length > 0
      ? getApp()
      : initializeApp({ credential: applicationDefault(), ...(projectId ? { projectId } : {}) });
  const auth = getAuth(app);
  const adminUser = await auth.getUserByEmail(adminEmail);
  const customToken = await auth.createCustomToken(adminUser.uid);

  const response = await fetchImpl(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseApiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to exchange a custom token for an ID token (status ${response.status})`);
  }
  const body = await response.json();
  return body.idToken;
}

async function main() {
  const exportFilePath = process.argv[2];
  if (!exportFilePath) {
    console.error("Usage: node scripts/bulk-provision-members.mjs <path-to-export.json>");
    process.exitCode = 1;
    return;
  }

  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3000";
  const adminEmail = process.env.ADMIN_EMAIL;
  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!adminEmail || !firebaseApiKey) {
    console.error("ADMIN_EMAIL and NEXT_PUBLIC_FIREBASE_API_KEY environment variables are required.");
    process.exitCode = 1;
    return;
  }

  const idToken = await mintAdminIdToken({
    adminEmail,
    firebaseApiKey,
    projectId: process.env.FIREBASE_PROJECT_ID,
  });

  await run({ exportFilePath: resolve(exportFilePath), apiBaseUrl, idToken });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
