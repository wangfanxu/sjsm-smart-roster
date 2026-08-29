import { authorizeRequest } from "@/auth/authorize";
import { apiErrorResponse } from "@/api/errors";
import { createRoleInput, parseJson } from "@/api/validation";
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

export async function handleRolesPost(request: Request, dependencies: ApiDependencies) {
  try {
    const actor = await authorizeRequest(request, "user:manage", dependencies.auth);
    const input = await parseJson(request, createRoleInput);
    const role = await dependencies.service.createRole(input, actor);
    return Response.json({ role }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function GET(request: Request) {
  return handleRolesGet(request, getServerApiDependencies());
}

export function POST(request: Request) {
  return handleRolesPost(request, getServerApiDependencies());
}
