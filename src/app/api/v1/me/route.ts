import { authorizeRequest } from "@/auth/authorize";
import { authErrorResponse } from "@/auth/errors";
import { getServerAuthDependencies } from "@/auth/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const principal = await authorizeRequest(
      request,
      "profile:read:self",
      getServerAuthDependencies(),
    );

    return Response.json({
      user: {
        id: principal.userId,
        email: principal.email,
        displayName: principal.displayName,
        systemRole: principal.systemRole,
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
