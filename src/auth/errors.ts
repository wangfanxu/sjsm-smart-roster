export type AuthErrorCode =
  | "missing_token"
  | "invalid_token"
  | "user_not_registered"
  | "user_inactive"
  | "permission_denied";

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function authErrorResponse(error: unknown): Response {
  if (error instanceof AuthError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  return Response.json(
    { error: { code: "internal_error", message: "An unexpected error occurred" } },
    { status: 500 },
  );
}
