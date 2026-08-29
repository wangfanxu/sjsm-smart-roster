import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error The executable provisioning script is intentionally plain ESM.
import { collectUniqueCapabilities, ensureRoles, mapSystemRole, normalizeRow, partitionRows, provisionUser, roleSlug, run, syncMemberRoles } from "../../scripts/bulk-provision-members.mjs";

function jsonResponse(status: number, body: unknown) {
  return { status, ok: status < 400, json: async () => body };
}

function createFakeApi(initialRoles: Array<{ id: string; slug: string; name: string }> = []) {
  const state = {
    roles: [...initialRoles],
    users: [] as Array<{ id: string; email: string; displayName: string; systemRole: string }>,
    memberRoles: new Map<string, Array<{ roleId: string; proficiency: string }>>(),
    nextId: 1,
  };

  const fetchImpl = async (url: string, options: RequestInit = {}) => {
    const path = url.replace("https://fake.test/api/v1", "");
    const method = options.method ?? "GET";
    const parsedBody = options.body ? JSON.parse(options.body as string) : undefined;

    if (path === "/roles" && method === "GET") {
      return jsonResponse(200, { roles: state.roles });
    }
    if (path === "/roles" && method === "POST") {
      if (state.roles.some((role) => role.slug === parsedBody.slug)) {
        return jsonResponse(409, { error: { code: "role_slug_already_exists" } });
      }
      const role = { id: `role-${state.nextId++}`, slug: parsedBody.slug, name: parsedBody.name };
      state.roles.push(role);
      return jsonResponse(201, { role });
    }
    if (path === "/users" && method === "GET") {
      return jsonResponse(200, { users: state.users.map((user) => ({ ...user, roles: [] })) });
    }
    if (path === "/users" && method === "POST") {
      if (state.users.some((user) => user.email === parsedBody.email)) {
        return jsonResponse(409, { error: { code: "email_already_registered" } });
      }
      const user = {
        id: `user-${state.nextId++}`,
        email: parsedBody.email,
        displayName: parsedBody.displayName,
        systemRole: parsedBody.systemRole,
      };
      state.users.push(user);
      return jsonResponse(201, { user });
    }
    const rolesMatch = /^\/users\/(.+)\/roles$/.exec(path);
    if (rolesMatch && method === "PUT") {
      const userId = rolesMatch[1];
      state.memberRoles.set(userId, parsedBody.capabilities);
      return jsonResponse(200, {
        memberRoles: parsedBody.capabilities.map(
          (capability: { roleId: string; proficiency: string }) => ({ userId, ...capability }),
        ),
      });
    }
    throw new Error(`Unhandled fake API request: ${method} ${path}`);
  };

  return { fetchImpl, state };
}

describe("bulk-provision-members pure helpers", () => {
  it("slugifies role names", () => {
    expect(roleSlug("Lead Vocals")).toBe("lead-vocals");
    expect(roleSlug("  Drums! ")).toBe("drums");
  });

  it("maps legacy roles to system roles", () => {
    expect(mapSystemRole("admin")).toBe("administrator");
    expect(mapSystemRole("worship-leader")).toBe("team_leader");
    expect(mapSystemRole("member")).toBe("volunteer");
    expect(mapSystemRole(undefined)).toBe("volunteer");
  });

  it("normalizes a valid row and dedupes capabilities with primary winning", () => {
    const result = normalizeRow(
      {
        email: "  Someone@Example.test ",
        displayName: "Someone",
        role: "worship-leader",
        primaryInstrument: "Drums",
        secondaryInstruments: ["Drums", "Vocals"],
      },
      0,
    );

    expect(result).toEqual({
      ok: true,
      index: 0,
      member: {
        email: "someone@example.test",
        displayName: "Someone",
        systemRole: "team_leader",
        capabilities: [
          { slug: "drums", name: "Drums", proficiency: "primary" },
          { slug: "vocals", name: "Vocals", proficiency: "secondary" },
        ],
      },
    });
  });

  it("reports rows with no email or a malformed email without echoing them", () => {
    expect(normalizeRow({ displayName: "No Email" }, 1)).toEqual({
      ok: false,
      index: 1,
      reason: "missing_email",
    });
    expect(normalizeRow({ email: "not-an-email", displayName: "Bad" }, 2)).toEqual({
      ok: false,
      index: 2,
      reason: "malformed_email",
    });
    expect(normalizeRow({ email: "a@b.test" }, 3)).toEqual({
      ok: false,
      index: 3,
      reason: "missing_display_name",
    });
  });

  it("partitions rows into unique members, invalid rows, and duplicates", () => {
    const { members, invalid, duplicates } = partitionRows([
      { email: "a@example.test", displayName: "A" },
      { email: "A@Example.test", displayName: "A again" },
      { displayName: "No email" },
      { email: "b@example.test", displayName: "B" },
    ]);

    expect(members).toHaveLength(2);
    expect(members.map((member: { email: string }) => member.email)).toEqual([
      "a@example.test",
      "b@example.test",
    ]);
    expect(invalid).toEqual([{ ok: false, index: 2, reason: "missing_email" }]);
    expect(duplicates).toEqual([{ index: 1, firstSeenAtIndex: 0 }]);
  });

  it("collects unique capabilities across members, keeping the first name seen", () => {
    const capabilities = collectUniqueCapabilities([
      { capabilities: [{ slug: "drums", name: "Drums", proficiency: "primary" }] },
      { capabilities: [{ slug: "drums", name: "Drum Kit", proficiency: "secondary" }] },
      { capabilities: [{ slug: "vocals", name: "Vocals", proficiency: "primary" }] },
    ]);

    expect(capabilities).toEqual([
      { slug: "drums", name: "Drums" },
      { slug: "vocals", name: "Vocals" },
    ]);
  });
});

describe("bulk-provision-members network helpers", () => {
  it("creates only the roles that don't already exist", async () => {
    const { fetchImpl, state } = createFakeApi([{ id: "role-existing", slug: "drums", name: "Drums" }]);

    const { roleIdBySlug, created } = await ensureRoles(
      [
        { slug: "drums", name: "Drums" },
        { slug: "vocals", name: "Vocals" },
      ],
      { existingRoles: state.roles, apiBaseUrl: "https://fake.test", idToken: "token", fetchImpl },
    );

    expect(created).toBe(1);
    expect(roleIdBySlug.get("drums")).toBe("role-existing");
    expect(roleIdBySlug.get("vocals")).toBe(state.roles.find((role) => role.slug === "vocals")?.id);
  });

  it("creates a new user, and skips one whose email is already provisioned", async () => {
    const { fetchImpl } = createFakeApi();
    const existingUserIdByEmail = new Map([["existing@example.test", "user-existing"]]);

    const created = await provisionUser(
      { email: "new@example.test", displayName: "New", systemRole: "volunteer" },
      { apiBaseUrl: "https://fake.test", idToken: "token", existingUserIdByEmail, fetchImpl },
    );
    expect(created).toEqual({ status: "created", userId: expect.stringMatching(/^user-/) });

    const skipped = await provisionUser(
      { email: "existing@example.test", displayName: "Existing", systemRole: "volunteer" },
      { apiBaseUrl: "https://fake.test", idToken: "token", existingUserIdByEmail, fetchImpl },
    );
    expect(skipped).toEqual({ status: "skipped", userId: "user-existing" });
  });

  it("syncs only the capabilities whose role id is known", async () => {
    const { fetchImpl, state } = createFakeApi();
    const roleIdBySlug = new Map([["drums", "role-drums"]]);

    await syncMemberRoles(
      "user-1",
      {
        capabilities: [
          { slug: "drums", proficiency: "primary" },
          { slug: "unknown-role", proficiency: "secondary" },
        ],
      },
      roleIdBySlug,
      { apiBaseUrl: "https://fake.test", idToken: "token", fetchImpl },
    );

    expect(state.memberRoles.get("user-1")).toEqual([{ roleId: "role-drums", proficiency: "primary" }]);
  });
});

describe("bulk-provision-members run()", () => {
  let exportDir: string;

  beforeEach(async () => {
    exportDir = await mkdtemp(join(tmpdir(), "bulk-provision-test-"));
  });

  afterEach(async () => {
    await rm(exportDir, { recursive: true, force: true });
  });

  it("provisions new members, skips an already-registered one, and syncs role capabilities", async () => {
    const { fetchImpl, state } = createFakeApi();
    state.users.push({
      id: "user-existing",
      email: "existing@example.test",
      displayName: "Existing",
      systemRole: "volunteer",
    });

    const exportFilePath = join(exportDir, "export.json");
    await writeFile(
      exportFilePath,
      JSON.stringify([
        {
          email: "new@example.test",
          displayName: "New Member",
          role: "worship-leader",
          primaryInstrument: "Drums",
          secondaryInstruments: ["Vocals"],
        },
        { email: "existing@example.test", displayName: "Existing", role: "member" },
        { displayName: "Missing email" },
        { email: "new@example.test", displayName: "Duplicate of first row" },
      ]),
    );

    const logs: string[] = [];
    const result = await run({
      exportFilePath,
      apiBaseUrl: "https://fake.test",
      idToken: "token",
      fetchImpl,
      log: (line: string) => logs.push(line),
    });

    expect(result).toMatchObject({
      rowCount: 4,
      invalidCount: 1,
      duplicateCount: 1,
      rolesCreated: 2,
      created: 1,
      skipped: 1,
      failed: 0,
      rolesSynced: 2,
      rolesSyncSkipped: 0,
    });

    const newUser = state.users.find((user) => user.email === "new@example.test");
    expect(newUser?.systemRole).toBe("team_leader");
    const drumsRole = state.roles.find((role) => role.slug === "drums");
    expect(state.memberRoles.get(newUser!.id)).toEqual([
      { roleId: drumsRole!.id, proficiency: "primary" },
      { roleId: state.roles.find((role) => role.slug === "vocals")!.id, proficiency: "secondary" },
    ]);
    expect(state.memberRoles.get("user-existing")).toEqual([]);

    expect(logs.join("\n")).not.toContain("new@example.test");
    expect(logs.join("\n")).not.toContain("existing@example.test");
  });
});
