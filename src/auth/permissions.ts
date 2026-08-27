import type { Permission, SystemRole } from "./types";

const volunteerPermissions = [
  "profile:read:self",
  "assignment:read:self",
  "availability:read:self",
  "availability:write:self",
  "replacement:create:self",
] as const satisfies readonly Permission[];

const teamLeaderPermissions = [
  ...volunteerPermissions,
  "team:read",
  "replacement:review",
] as const satisfies readonly Permission[];

const administratorPermissions = [
  ...teamLeaderPermissions,
  "planning:manage",
  "roster:generate",
  "roster:publish",
  "user:manage",
  "notification:send",
] as const satisfies readonly Permission[];

export const permissionsByRole: Readonly<Record<SystemRole, ReadonlySet<Permission>>> = {
  volunteer: new Set(volunteerPermissions),
  team_leader: new Set(teamLeaderPermissions),
  administrator: new Set(administratorPermissions),
};

export function hasPermission(role: SystemRole, permission: Permission): boolean {
  return permissionsByRole[role].has(permission);
}
