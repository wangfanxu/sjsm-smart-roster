import { authenticateRequest } from "@/auth/authorize";
import { apiErrorResponse } from "@/api/errors";
import { AuthError } from "@/auth/errors";
import { hasPermission } from "@/auth/permissions";
import { memberRolesInput, parseJson, uuidParameter } from "@/api/validation";
import { getServerApiDependencies, type ApiDependencies } from "@/server/api-dependencies";

export const runtime = "nodejs";

type RouteContext = Readonly<{ params: Promise<{ userId: string }> }>;

export async function handleMemberRolesPut(
  request: Request,
  context: RouteContext,
  dependencies: ApiDependencies,
) {
  try {
    const actor = await authenticateRequest(request, dependencies.auth);
    const userId = uuidParameter.parse((await context.params).userId);
    const isSelf = actor.userId === userId;
    const authorized =
      hasPermission(actor.systemRole, "user:manage") ||
      (isSelf && hasPermission(actor.systemRole, "profile:write:roles:self"));
    if (!authorized) {
      throw new AuthError("permission_denied", 403, "The authenticated user is not authorized");
    }
    const { capabilities } = await parseJson(request, memberRolesInput);
    const memberRoles = await dependencies.service.replaceMemberRoles(userId, capabilities, actor);
    return Response.json({ memberRoles });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function PUT(request: Request, context: RouteContext) {
  return handleMemberRolesPut(request, context, getServerApiDependencies());
}
