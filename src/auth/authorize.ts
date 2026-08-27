import { AuthError } from "./errors";
import { hasPermission } from "./permissions";
import type {
  AuthenticatedPrincipal,
  Permission,
  TokenVerifier,
  UserRepository,
} from "./types";

export type AuthDependencies = Readonly<{
  tokenVerifier: TokenVerifier;
  userRepository: UserRepository;
}>;

function readBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    throw new AuthError("missing_token", 401, "A Firebase ID token is required");
  }

  return match[1];
}

export async function authenticateRequest(
  request: Request,
  dependencies: AuthDependencies,
): Promise<AuthenticatedPrincipal> {
  const token = readBearerToken(request);

  let firebaseUid: string;
  try {
    const decodedToken = await dependencies.tokenVerifier.verifyIdToken(token);
    firebaseUid = decodedToken.uid;
  } catch {
    throw new AuthError("invalid_token", 401, "The Firebase ID token is invalid or expired");
  }

  if (!firebaseUid) {
    throw new AuthError("invalid_token", 401, "The Firebase ID token has no user identity");
  }

  const user = await dependencies.userRepository.findByFirebaseUid(firebaseUid);

  if (!user) {
    throw new AuthError(
      "user_not_registered",
      403,
      "The authenticated Firebase identity is not registered",
    );
  }

  if (!user.isActive) {
    throw new AuthError("user_inactive", 403, "The application user is inactive");
  }

  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    systemRole: user.systemRole,
  };
}

export async function authorizeRequest(
  request: Request,
  permission: Permission,
  dependencies: AuthDependencies,
): Promise<AuthenticatedPrincipal> {
  const principal = await authenticateRequest(request, dependencies);

  if (!hasPermission(principal.systemRole, permission)) {
    throw new AuthError("permission_denied", 403, "The authenticated user is not authorized");
  }

  return principal;
}
