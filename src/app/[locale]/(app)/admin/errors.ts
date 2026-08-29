import { ApiRequestError } from "@/lib/api-client";
import { describeApiErrorCode, type AdminMessages } from "./messages";

type ValidationField = Readonly<{ path: string; message: string }>;

function isValidationFieldArray(value: unknown): value is ValidationField[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as Record<string, unknown>).path === "string",
    )
  );
}

/**
 * Returns the top-level segment of every field path reported by the API's
 * `validation_error` response (e.g. "requirements.0.roleId" -> "requirements"),
 * so callers can decide which form field to flag without trusting the
 * server's English-only message text (all UI copy must stay bilingual).
 */
export function extractValidationFieldPaths(error: unknown): string[] {
  if (!(error instanceof ApiRequestError) || error.payload.code !== "validation_error") return [];
  const fields = (error.payload as unknown as { fields?: unknown }).fields;
  if (!isValidationFieldArray(fields)) return [];
  return fields.map((field) => field.path);
}

export function resolveApiErrorMessage(error: unknown, messages: AdminMessages): string {
  if (error instanceof ApiRequestError) {
    return describeApiErrorCode(error.payload.code, messages);
  }
  return messages.apiErrorNetwork;
}
