import { apiErrorResponse } from "@/api/errors";
import { uuidParameter } from "@/api/validation";
import { authorizeRequest } from "@/auth/authorize";
import {
  getServerApiDependencies,
  type ApiDependencies,
} from "@/server/api-dependencies";

export const runtime = "nodejs";

type RouteContext = Readonly<{
  params: Promise<{ periodId: string; candidateId: string; assignmentId: string }>;
}>;

export async function handleEligibleUsersGet(
  request: Request,
  context: RouteContext,
  dependencies: ApiDependencies,
) {
  try {
    await authorizeRequest(request, "roster:generate", dependencies.auth);
    const { periodId: rawPeriodId, candidateId: rawCandidateId, assignmentId: rawAssignmentId } =
      await context.params;
    const periodId = uuidParameter.parse(rawPeriodId);
    const candidateId = uuidParameter.parse(rawCandidateId);
    const assignmentId = uuidParameter.parse(rawAssignmentId);
    const eligibleUsers = await dependencies.service.getEligibleAssignees(
      periodId,
      candidateId,
      assignmentId,
    );
    return Response.json({ eligibleUsers });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function GET(request: Request, context: RouteContext) {
  return handleEligibleUsersGet(request, context, getServerApiDependencies());
}
