import { apiErrorResponse } from "@/api/errors";
import { approveReplacementRequestInput, parseJson, uuidParameter } from "@/api/validation";
import { authorizeRequest } from "@/auth/authorize";
import { getServerApiDependencies, type ApiDependencies } from "@/server/api-dependencies";

export const runtime = "nodejs";

type RouteContext = Readonly<{ params: Promise<{ requestId: string }> }>;

export async function handleReplacementApprovePost(
  request: Request,
  context: RouteContext,
  dependencies: ApiDependencies,
) {
  try {
    const actor = await authorizeRequest(request, "replacement:review", dependencies.auth);
    const requestId = uuidParameter.parse((await context.params).requestId);
    const input = await parseJson(request, approveReplacementRequestInput);
    const replacementRequest = await dependencies.service.approveReplacementRequest(
      requestId,
      input.replacementUserId,
      actor,
    );
    try {
      await dependencies.notifications.notifyReplacementApproved(requestId);
    } catch (notificationError) {
      console.error("Failed to send replacement-approved notifications", notificationError);
    }
    return Response.json({ replacementRequest });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function POST(request: Request, context: RouteContext) {
  return handleReplacementApprovePost(request, context, getServerApiDependencies());
}
