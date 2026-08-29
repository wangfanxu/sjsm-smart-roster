export type ApiErrorPayload = Readonly<{
  code: string;
  message: string;
  details?: unknown;
}>;

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: ApiErrorPayload,
  ) {
    super(payload.message);
    this.name = "ApiRequestError";
  }
}

export async function apiFetch<T>(
  path: string,
  idToken: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("authorization", `Bearer ${idToken}`);
  if (options.body) headers.set("content-type", "application/json");

  const response = await fetch(`/api/v1${path}`, { ...options, headers });
  const body = (await response.json().catch(() => null)) as
    | T
    | { error: ApiErrorPayload }
    | null;

  if (!response.ok) {
    const errorPayload =
      body && typeof body === "object" && "error" in body
        ? body.error
        : { code: "unknown_error", message: "The request failed" };
    throw new ApiRequestError(response.status, errorPayload);
  }

  return body as T;
}
