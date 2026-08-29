import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readAllMigrationsSql } from "./apply-migrations-for-tests";
import { createUserRepository } from "./user-repository";
import * as schema from "./schema";

describe("user repository account linking", () => {
  let pglite: PGlite;
  let database: PgliteDatabase<typeof schema>;

  beforeEach(async () => {
    pglite = await PGlite.create();
    await pglite.exec(await readAllMigrationsSql());
    database = drizzle(pglite, { schema });
    await pglite.exec(`
      INSERT INTO users (id, firebase_uid, email, display_name, system_role) VALUES
        ('00000000-0000-4000-a000-000000000001', NULL, 'pending@example.test', 'Pending Volunteer', 'volunteer'),
        ('00000000-0000-4000-a000-000000000002', 'already-linked-uid', 'linked@example.test', 'Linked Volunteer', 'volunteer');
    `);
  });

  afterEach(async () => {
    await pglite.close();
  });

  function repository() {
    return createUserRepository(database as unknown as PostgresJsDatabase<typeof schema>);
  }

  it("links a pending row on first sign-in", async () => {
    const linked = await repository().linkPendingUserByEmail("pending@example.test", "new-uid");

    expect(linked).toMatchObject({
      id: "00000000-0000-4000-a000-000000000001",
      firebaseUid: "new-uid",
      email: "pending@example.test",
    });

    const found = await repository().findByFirebaseUid("new-uid");
    expect(found?.id).toBe("00000000-0000-4000-a000-000000000001");
  });

  it("does not link an already-linked row to a different account (no hijacking)", async () => {
    const result = await repository().linkPendingUserByEmail("linked@example.test", "attacker-uid");

    expect(result).toBeNull();
    const stillLinkedToOriginal = await repository().findByFirebaseUid("already-linked-uid");
    expect(stillLinkedToOriginal?.email).toBe("linked@example.test");
    const attackerHasNoMatch = await repository().findByFirebaseUid("attacker-uid");
    expect(attackerHasNoMatch).toBeNull();
  });

  it("returns null when no row matches the email at all", async () => {
    const result = await repository().linkPendingUserByEmail("nobody@example.test", "some-uid");

    expect(result).toBeNull();
  });

  it("only the first of two concurrent link attempts for the same pending row succeeds", async () => {
    const repo = repository();
    const [first, second] = await Promise.all([
      repo.linkPendingUserByEmail("pending@example.test", "uid-a"),
      repo.linkPendingUserByEmail("pending@example.test", "uid-b"),
    ]);

    const successes = [first, second].filter((result) => result !== null);
    expect(successes).toHaveLength(1);
  });
});
