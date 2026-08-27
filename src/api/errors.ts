import { AuthError } from "@/auth/errors";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiErrorResponse(error: unknown): Response {
  if (error instanceof AuthError || error instanceof ApiError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "validation_error",
          message: "The request is invalid",
          fields: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 400 },
    );
  }

  return Response.json(
    { error: { code: "internal_error", message: "An unexpected error occurred" } },
    { status: 500 },
  );
}
