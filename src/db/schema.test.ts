import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readAllMigrationsSql } from "./apply-migrations-for-tests";

describe("initial PostgreSQL migration", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = await PGlite.create();
    await database.exec(await readAllMigrationsSql());
  });

  afterEach(async () => {
    await database.close();
  });

  it("creates the complete domain model from version-controlled SQL", async () => {
    const result = await database.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    expect(result.rows.map((row) => row.table_name)).toEqual([
      "assignments",
      "audit_events",
      "availability",
      "notification_deliveries",
      "planning_periods",
      "replacement_requests",
      "roles",
      "roster_candidates",
      "scheduling_constraints",
      "service_role_requirements",
      "service_songs",
      "services",
      "user_roles",
      "users",
    ]);
  });

  it("enforces identity, date-range, and required-capacity invariants", async () => {
    await database.exec(`
      INSERT INTO users (id, firebase_uid, email, display_name)
      VALUES ('00000000-0000-0000-0000-000000000001', 'firebase-1', 'volunteer@example.test', 'Test Volunteer');
      INSERT INTO roles (id, slug, name)
      VALUES ('00000000-0000-0000-0000-000000000002', 'piano', 'Piano');
      INSERT INTO planning_periods (id, name, starts_on, ends_on)
      VALUES ('00000000-0000-0000-0000-000000000003', 'Autumn', '2026-09-01', '2026-10-31');
      INSERT INTO services (id, planning_period_id, title, starts_at)
      VALUES (
        '00000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000003',
        'Sunday Worship',
        '2026-09-06T10:00:00Z'
      );
    `);

    await expect(
      database.exec(`
        INSERT INTO users (id, firebase_uid, email, display_name)
        VALUES ('00000000-0000-0000-0000-000000000005', 'firebase-1', 'other@example.test', 'Other');
      `),
    ).rejects.toThrow();

    await expect(
      database.exec(`
        INSERT INTO planning_periods (id, name, starts_on, ends_on)
        VALUES ('00000000-0000-0000-0000-000000000006', 'Invalid', '2026-10-01', '2026-09-01');
      `),
    ).rejects.toThrow();

    await expect(
      database.exec(`
        INSERT INTO service_role_requirements (service_id, role_id, required_count)
        VALUES (
          '00000000-0000-0000-0000-000000000004',
          '00000000-0000-0000-0000-000000000002',
          0
        );
      `),
    ).rejects.toThrow();

    await expect(
      database.exec(`
        INSERT INTO service_songs (service_id, title, sort_order)
        VALUES ('00000000-0000-0000-0000-000000000004', 'Amazing Grace', 0);
      `),
    ).rejects.toThrow();

    await database.exec(`
      INSERT INTO service_songs (service_id, title, sort_order)
      VALUES ('00000000-0000-0000-0000-000000000004', 'Amazing Grace', 1);
    `);

    await expect(
      database.exec(`
        INSERT INTO service_songs (service_id, title, sort_order)
        VALUES ('00000000-0000-0000-0000-000000000004', 'How Great Thou Art', 1);
      `),
    ).rejects.toThrow();
  });

  it("prevents conflicting assignments and duplicate notification delivery", async () => {
    await database.exec(`
      INSERT INTO users (id, firebase_uid, email, display_name)
      VALUES ('10000000-0000-0000-0000-000000000001', 'firebase-2', 'member@example.test', 'Test Member');
      INSERT INTO roles (id, slug, name) VALUES
        ('10000000-0000-0000-0000-000000000002', 'piano', 'Piano'),
        ('10000000-0000-0000-0000-000000000003', 'vocal', 'Vocal');
      INSERT INTO planning_periods (id, name, starts_on, ends_on)
      VALUES ('10000000-0000-0000-0000-000000000004', 'Autumn', '2026-09-01', '2026-10-31');
      INSERT INTO services (id, planning_period_id, title, starts_at)
      VALUES (
        '10000000-0000-0000-0000-000000000005',
        '10000000-0000-0000-0000-000000000004',
        'Sunday Worship',
        '2026-09-06T10:00:00Z'
      );
      INSERT INTO roster_candidates (
        id, planning_period_id, version, hard_constraints_satisfied
      ) VALUES (
        '10000000-0000-0000-0000-000000000006',
        '10000000-0000-0000-0000-000000000004',
        1,
        true
      );
      INSERT INTO assignments (id, candidate_id, service_id, role_id, user_id) VALUES (
        '10000000-0000-0000-0000-000000000007',
        '10000000-0000-0000-0000-000000000006',
        '10000000-0000-0000-0000-000000000005',
        '10000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000001'
      );
      INSERT INTO notification_deliveries (
        id, user_id, assignment_id, event_type, recipient_email, idempotency_key
      ) VALUES (
        '10000000-0000-0000-0000-000000000008',
        '10000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000007',
        'assignment.created',
        'member@example.test',
        'assignment-7-created'
      );
    `);

    await expect(
      database.exec(`
        INSERT INTO assignments (id, candidate_id, service_id, role_id, user_id) VALUES (
          '10000000-0000-0000-0000-000000000009',
          '10000000-0000-0000-0000-000000000006',
          '10000000-0000-0000-0000-000000000005',
          '10000000-0000-0000-0000-000000000003',
          '10000000-0000-0000-0000-000000000001'
        );
      `),
    ).rejects.toThrow();

    await expect(
      database.exec(`
        INSERT INTO notification_deliveries (
          id, user_id, event_type, recipient_email, idempotency_key
        ) VALUES (
          '10000000-0000-0000-0000-000000000010',
          '10000000-0000-0000-0000-000000000001',
          'assignment.created',
          'member@example.test',
          'assignment-7-created'
        );
      `),
    ).rejects.toThrow();
  });
});
