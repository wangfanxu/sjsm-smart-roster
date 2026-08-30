import { apiErrorResponse } from "@/api/errors";
import { createReplacementRequestInput, parseJson } from "@/api/validation";
import { authorizeRequest } from "@/auth/authorize";
import { getServerApiDependencies, type ApiDependencies } from "@/server/api-dependencies";

export const runtime = "nodejs";

export async function handleReplacementRequestsGet(request: Request, dependencies: ApiDependencies) {
  try {
    await authorizeRequest(request, "replacement:review", dependencies.auth);
    const replacementRequests = await dependencies.service.listReplacementRequests();
    return Response.json({ replacementRequests });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function handleReplacementRequestsPost(request: Request, dependencies: ApiDependencies) {
  try {
    const actor = await authorizeRequest(request, "replacement:create:self", dependencies.auth);
    const input = await parseJson(request, createReplacementRequestInput);
    const replacementRequest = await dependencies.service.requestReplacement(
      input.assignmentId,
      input.reason,
      actor,
    );
    return Response.json({ replacementRequest }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function GET(request: Request) {
  return handleReplacementRequestsGet(request, getServerApiDependencies());
}

export function POST(request: Request) {
  return handleReplacementRequestsPost(request, getServerApiDependencies());
}
