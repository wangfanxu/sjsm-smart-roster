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
  | "roster:review"
  | "roster:publish"
  | "user:manage"
  | "notification:send";

export type ApplicationUser = Readonly<{
  id: string;
  firebaseUid: string | null;
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
  verifyIdToken(token: string): Promise<{ uid: string; email: string | null }>;
}

export interface UserRepository {
  findByFirebaseUid(firebaseUid: string): Promise<ApplicationUser | null>;
  /**
   * Atomically claims a pending row (email match, firebase_uid still null)
   * for a first-time sign-in. Returns null if no pending row matches -
   * including when the row is already linked to a different account, since
   * the match requires firebase_uid IS NULL.
   */
  linkPendingUserByEmail(email: string, firebaseUid: string): Promise<ApplicationUser | null>;
}
