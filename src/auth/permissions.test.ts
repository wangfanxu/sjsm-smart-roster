import { describe, expect, it } from "vitest";
import { hasPermission } from "./permissions";

describe("role permissions", () => {
  it("limits volunteers to their own profile, assignments, availability, and replacements", () => {
    expect(hasPermission("volunteer", "assignment:read:self")).toBe(true);
    expect(hasPermission("volunteer", "availability:write:self")).toBe(true);
    expect(hasPermission("volunteer", "profile:write:self")).toBe(true);
    expect(hasPermission("volunteer", "profile:write:roles:self")).toBe(true);
    expect(hasPermission("volunteer", "team:read")).toBe(false);
    expect(hasPermission("volunteer", "roster:publish")).toBe(false);
  });

  it("allows team leaders to inspect team data but not administer rosters", () => {
    expect(hasPermission("team_leader", "assignment:read:self")).toBe(true);
    expect(hasPermission("team_leader", "team:read")).toBe(true);
    expect(hasPermission("team_leader", "replacement:review")).toBe(true);
    expect(hasPermission("team_leader", "songs:manage")).toBe(true);
    expect(hasPermission("volunteer", "songs:manage")).toBe(false);
    expect(hasPermission("team_leader", "roster:generate")).toBe(false);
    expect(hasPermission("team_leader", "roster:review")).toBe(false);
    expect(hasPermission("team_leader", "user:manage")).toBe(false);
  });

  it("grants administrators every defined capability", () => {
    expect(hasPermission("administrator", "team:read")).toBe(true);
    expect(hasPermission("administrator", "planning:manage")).toBe(true);
    expect(hasPermission("administrator", "roster:generate")).toBe(true);
    expect(hasPermission("administrator", "roster:review")).toBe(true);
    expect(hasPermission("administrator", "roster:publish")).toBe(true);
    expect(hasPermission("administrator", "notification:send")).toBe(true);
  });
});
