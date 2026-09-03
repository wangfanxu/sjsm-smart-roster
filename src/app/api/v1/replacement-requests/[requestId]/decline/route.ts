import { apiErrorResponse } from "@/api/errors";
import { uuidParameter } from "@/api/validation";
import { authorizeRequest } from "@/auth/authorize";
import { getServerApiDependencies, type ApiDependencies } from "@/server/api-dependencies";

export const runtime = "nodejs";

type RouteContext = Readonly<{ params: Promise<{ requestId: string }> }>;

export async function handleReplacementDeclinePost(
  request: Request,
  context: RouteContext,
  dependencies: ApiDependencies,
) {
  try {
    const actor = await authorizeRequest(request, "replacement:review", dependencies.auth);
    const requestId = uuidParameter.parse((await context.params).requestId);
    const replacementRequest = await dependencies.service.declineReplacementRequest(requestId, actor);
    try {
      await dependencies.notifications.notifyReplacementDeclined(requestId);
    } catch (notificationError) {
      console.error("Failed to send replacement-declined notification", notificationError);
    }
    return Response.json({ replacementRequest });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function POST(request: Request, context: RouteContext) {
  return handleReplacementDeclinePost(request, context, getServerApiDependencies());
}
