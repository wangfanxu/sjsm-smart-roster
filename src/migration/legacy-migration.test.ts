import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readAllMigrationsSql } from "@/db/apply-migrations-for-tests";
// @ts-expect-error The executable migration spike is intentionally plain ESM.
import { buildMigrationSql, transformLegacyFixture } from "../../scripts/legacy-migration-spike.mjs";

const fixturePath = fileURLToPath(
  new URL("../../fixtures/legacy/synthetic-firestore.json", import.meta.url),
);
const generatedSqlPath = fileURLToPath(
  new URL("../../artifacts/migration/legacy-migration.sql", import.meta.url),
);
const generatedReportPath = fileURLToPath(
  new URL("../../artifacts/migration/legacy-migration-report.json", import.meta.url),
);

async function readFixture() {
  return JSON.parse(await readFile(fixturePath, "utf8"));
}

describe("legacy migration spike", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = await PGlite.create();
    await database.exec(await readAllMigrationsSql());
  });

  afterEach(async () => {
    await database.close();
  });

  it("transforms the synthetic Firestore shape into relational records", async () => {
    const { target, report } = transformLegacyFixture(await readFixture());

    expect(report).toMatchObject({
      synthetic: true,
      containsPersonalData: false,
      sourceCounts: { users: 7, events: 2, availability: 1, serviceRequests: 1 },
      targetCounts: {
        users: 7,
        services: 2,
        availability: 1,
        assignments: 11,
        replacementRequests: 1,
      },
    });
    expect(report.checks.every((check: { passed: boolean }) => check.passed)).toBe(true);

    await database.exec(buildMigrationSql(target));
    const counts = await database.query<{ users: number; services: number; assignments: number }>(`
      SELECT
        (SELECT count(*)::int FROM users) AS users,
        (SELECT count(*)::int FROM services) AS services,
        (SELECT count(*)::int FROM assignments) AS assignments
    `);
    expect(counts.rows[0]).toEqual({ users: 7, services: 2, assignments: 11 });

    const orphanCount = await database.query<{ count: number }>(`
      SELECT count(*)::int AS count
      FROM assignments a
      LEFT JOIN users u ON u.id = a.user_id
      LEFT JOIN services s ON s.id = a.service_id
      LEFT JOIN roles r ON r.id = a.role_id
      WHERE u.id IS NULL OR s.id IS NULL OR r.id IS NULL
    `);
    expect(orphanCount.rows[0].count).toBe(0);
  });

  it("keeps committed SQL and the automated report reproducible", async () => {
    const { target, report } = transformLegacyFixture(await readFixture());

    expect(await readFile(generatedSqlPath, "utf8")).toBe(buildMigrationSql(target));
    expect(await readFile(generatedReportPath, "utf8")).toBe(
      `${JSON.stringify(report, null, 2)}\n`,
    );
  });

  it("rejects fixtures that may contain personal data", async () => {
    const fixture = await readFixture();
    fixture.collections.users[0].email = "person@real-domain.example";

    expect(() => transformLegacyFixture(fixture)).toThrow(/reserved example\.test domain/);
  });

  it("rejects broken legacy relationships before SQL is generated", async () => {
    const fixture = await readFixture();
    fixture.collections.events[0].roles.Drummer = "missing-user";

    expect(() => transformLegacyFixture(fixture)).toThrow(/references unknown user/);
  });
});
