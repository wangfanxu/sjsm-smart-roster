import { apiErrorResponse } from "@/api/errors";
import { parseJson, pendingUserInput } from "@/api/validation";
import { authorizeRequest } from "@/auth/authorize";
import { getServerApiDependencies, type ApiDependencies } from "@/server/api-dependencies";

export const runtime = "nodejs";

export async function handleUsersPost(request: Request, dependencies: ApiDependencies) {
  try {
    const actor = await authorizeRequest(request, "user:manage", dependencies.auth);
    const input = await parseJson(request, pendingUserInput);
    const user = await dependencies.service.createPendingUser(input, actor);
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function handleUsersGet(request: Request, dependencies: ApiDependencies) {
  try {
    await authorizeRequest(request, "user:manage", dependencies.auth);
    const users = await dependencies.service.listUsers();
    return Response.json({ users });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function POST(request: Request) {
  return handleUsersPost(request, getServerApiDependencies());
}

export function GET(request: Request) {
  return handleUsersGet(request, getServerApiDependencies());
}
