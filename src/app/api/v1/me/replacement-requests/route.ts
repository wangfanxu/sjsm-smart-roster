import { apiErrorResponse } from "@/api/errors";
import { authorizeRequest } from "@/auth/authorize";
import { getServerApiDependencies, type ApiDependencies } from "@/server/api-dependencies";

export const runtime = "nodejs";

export async function handleMyReplacementRequestsGet(request: Request, dependencies: ApiDependencies) {
  try {
    const actor = await authorizeRequest(request, "replacement:create:self", dependencies.auth);
    const replacementRequests = await dependencies.service.listMyReplacementRequests(actor);
    return Response.json({ replacementRequests });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function GET(request: Request) {
  return handleMyReplacementRequestsGet(request, getServerApiDependencies());
}
