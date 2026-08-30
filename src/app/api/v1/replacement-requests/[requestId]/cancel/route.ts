import { apiErrorResponse } from "@/api/errors";
import { uuidParameter } from "@/api/validation";
import { authorizeRequest } from "@/auth/authorize";
import { getServerApiDependencies, type ApiDependencies } from "@/server/api-dependencies";

export const runtime = "nodejs";

type RouteContext = Readonly<{ params: Promise<{ requestId: string }> }>;

export async function handleReplacementCancelPost(
  request: Request,
  context: RouteContext,
  dependencies: ApiDependencies,
) {
  try {
    const actor = await authorizeRequest(request, "replacement:create:self", dependencies.auth);
    const requestId = uuidParameter.parse((await context.params).requestId);
    const replacementRequest = await dependencies.service.cancelReplacementRequest(requestId, actor);
    return Response.json({ replacementRequest });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function POST(request: Request, context: RouteContext) {
  return handleReplacementCancelPost(request, context, getServerApiDependencies());
}
