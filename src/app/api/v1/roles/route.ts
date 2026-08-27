import { authorizeRequest } from "@/auth/authorize";
import { apiErrorResponse } from "@/api/errors";
import { getServerApiDependencies, type ApiDependencies } from "@/server/api-dependencies";

export const runtime = "nodejs";

export async function handleRolesGet(request: Request, dependencies: ApiDependencies) {
  try {
    await authorizeRequest(request, "profile:read:self", dependencies.auth);
    return Response.json({ roles: await dependencies.service.listRoles() });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function GET(request: Request) {
  return handleRolesGet(request, getServerApiDependencies());
}
