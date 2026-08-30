import { apiErrorResponse } from "@/api/errors";
import { parseJson, updateProfileInput } from "@/api/validation";
import { authorizeRequest } from "@/auth/authorize";
import { getServerApiDependencies, type ApiDependencies } from "@/server/api-dependencies";

export const runtime = "nodejs";

export async function handleMeGet(request: Request, dependencies: ApiDependencies) {
  try {
    const principal = await authorizeRequest(request, "profile:read:self", dependencies.auth);
    const roles = await dependencies.service.getMemberRoles(principal.userId);

    return Response.json({
      user: {
        id: principal.userId,
        email: principal.email,
        displayName: principal.displayName,
        systemRole: principal.systemRole,
        roles,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function handleMePatch(request: Request, dependencies: ApiDependencies) {
  try {
    const actor = await authorizeRequest(request, "profile:write:self", dependencies.auth);
    const input = await parseJson(request, updateProfileInput);
    const user = await dependencies.service.updateMyProfile(input.displayName, actor);
    return Response.json({ user });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function GET(request: Request) {
  return handleMeGet(request, getServerApiDependencies());
}

export function PATCH(request: Request) {
  return handleMePatch(request, getServerApiDependencies());
}
