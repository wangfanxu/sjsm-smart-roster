import { apiErrorResponse } from "@/api/errors";
import { uuidParameter } from "@/api/validation";
import { authorizeRequest } from "@/auth/authorize";
import { getServerApiDependencies, type ApiDependencies } from "@/server/api-dependencies";

export const runtime = "nodejs";

type RouteContext = Readonly<{ params: Promise<{ requestId: string }> }>;

export async function handleReplacementEligibleUsersGet(
  request: Request,
  context: RouteContext,
  dependencies: ApiDependencies,
) {
  try {
    await authorizeRequest(request, "replacement:review", dependencies.auth);
    const requestId = uuidParameter.parse((await context.params).requestId);
    const eligibleUsers = await dependencies.service.getEligibleReplacements(requestId);
    return Response.json({ eligibleUsers });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function GET(request: Request, context: RouteContext) {
  return handleReplacementEligibleUsersGet(request, context, getServerApiDependencies());
}
