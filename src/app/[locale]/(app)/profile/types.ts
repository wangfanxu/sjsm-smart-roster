export type SystemRole = "volunteer" | "team_leader" | "administrator";

export type Proficiency = "primary" | "secondary";

export type MemberRoleCapability = Readonly<{
  roleId: string;
  roleName: string;
  proficiency: Proficiency;
}>;

export type MemberProfile = Readonly<{
  id: string;
  email: string;
  displayName: string;
  systemRole: SystemRole;
  roles: ReadonlyArray<MemberRoleCapability>;
}>;

export type Role = Readonly<{
  id: string;
  slug: string;
  name: string;
  description: string | null;
}>;

export type RoleSelection = "none" | Proficiency;
