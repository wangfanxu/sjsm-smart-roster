import { apiErrorResponse } from "@/api/errors";
import { assignmentLockInput, parseJson, uuidParameter } from "@/api/validation";
import { authorizeRequest } from "@/auth/authorize";
import {
  getServerApiDependencies,
  type ApiDependencies,
} from "@/server/api-dependencies";

export const runtime = "nodejs";

type RouteContext = Readonly<{
  params: Promise<{ periodId: string; candidateId: string; assignmentId: string }>;
}>;

export async function handleAssignmentLockPatch(
  request: Request,
  context: RouteContext,
  dependencies: ApiDependencies,
) {
  try {
    const actor = await authorizeRequest(request, "roster:generate", dependencies.auth);
    const { periodId: rawPeriodId, candidateId: rawCandidateId, assignmentId: rawAssignmentId } =
      await context.params;
    const periodId = uuidParameter.parse(rawPeriodId);
    const candidateId = uuidParameter.parse(rawCandidateId);
    const assignmentId = uuidParameter.parse(rawAssignmentId);
    const input = await parseJson(request, assignmentLockInput);
    const result = await dependencies.service.setAssignmentLock(
      periodId,
      candidateId,
      assignmentId,
      input.isLocked,
      actor,
    );
    return Response.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function PATCH(request: Request, context: RouteContext) {
  return handleAssignmentLockPatch(request, context, getServerApiDependencies());
}
