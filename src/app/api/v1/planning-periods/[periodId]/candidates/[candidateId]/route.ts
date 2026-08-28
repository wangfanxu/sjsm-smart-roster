import { apiErrorResponse } from "@/api/errors";
import { uuidParameter } from "@/api/validation";
import { authorizeRequest } from "@/auth/authorize";
import {
  getServerApiDependencies,
  type ApiDependencies,
} from "@/server/api-dependencies";

export const runtime = "nodejs";

type RouteContext = Readonly<{
  params: Promise<{ periodId: string; candidateId: string }>;
}>;

export async function handleCandidateDetailGet(
  request: Request,
  context: RouteContext,
  dependencies: ApiDependencies,
) {
  try {
    await authorizeRequest(request, "roster:review", dependencies.auth);
    const { periodId: rawPeriodId, candidateId: rawCandidateId } = await context.params;
    const periodId = uuidParameter.parse(rawPeriodId);
    const candidateId = uuidParameter.parse(rawCandidateId);
    const detail = await dependencies.service.getRosterCandidateDetail(periodId, candidateId);
    return Response.json(detail);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function GET(request: Request, context: RouteContext) {
  return handleCandidateDetailGet(request, context, getServerApiDependencies());
}
