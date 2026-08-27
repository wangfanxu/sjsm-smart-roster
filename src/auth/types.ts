export type SystemRole = "volunteer" | "team_leader" | "administrator";

export type Permission =
  | "profile:read:self"
  | "assignment:read:self"
  | "availability:read:self"
  | "availability:write:self"
  | "replacement:create:self"
  | "team:read"
  | "replacement:review"
  | "planning:manage"
  | "roster:generate"
  | "roster:publish"
  | "user:manage"
  | "notification:send";

export type ApplicationUser = Readonly<{
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  systemRole: SystemRole;
  isActive: boolean;
}>;

export type AuthenticatedPrincipal = Readonly<{
  userId: string;
  email: string;
  displayName: string;
  systemRole: SystemRole;
}>;

export interface TokenVerifier {
  verifyIdToken(token: string): Promise<{ uid: string }>;
}

export interface UserRepository {
  findByFirebaseUid(firebaseUid: string): Promise<ApplicationUser | null>;
}
