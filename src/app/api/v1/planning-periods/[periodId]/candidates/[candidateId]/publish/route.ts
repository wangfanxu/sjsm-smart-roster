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

export async function handleCandidatePublishPost(
  request: Request,
  context: RouteContext,
  dependencies: ApiDependencies,
) {
  try {
    const actor = await authorizeRequest(request, "roster:publish", dependencies.auth);
    const { periodId: rawPeriodId, candidateId: rawCandidateId } = await context.params;
    const periodId = uuidParameter.parse(rawPeriodId);
    const candidateId = uuidParameter.parse(rawCandidateId);
    const candidate = await dependencies.service.publishCandidate(periodId, candidateId, actor);
    return Response.json({ candidate });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function POST(request: Request, context: RouteContext) {
  return handleCandidatePublishPost(request, context, getServerApiDependencies());
}
