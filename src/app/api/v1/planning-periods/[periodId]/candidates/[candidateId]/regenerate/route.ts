import { apiErrorResponse } from "@/api/errors";
import { candidateGenerationInput, parseJson, uuidParameter } from "@/api/validation";
import { authorizeRequest } from "@/auth/authorize";
import {
  getServerApiDependencies,
  type ApiDependencies,
} from "@/server/api-dependencies";

export const runtime = "nodejs";

type RouteContext = Readonly<{
  params: Promise<{ periodId: string; candidateId: string }>;
}>;

export async function handleCandidateRegeneratePost(
  request: Request,
  context: RouteContext,
  dependencies: ApiDependencies,
) {
  try {
    const actor = await authorizeRequest(request, "roster:generate", dependencies.auth);
    const { periodId: rawPeriodId, candidateId: rawCandidateId } = await context.params;
    const periodId = uuidParameter.parse(rawPeriodId);
    const candidateId = uuidParameter.parse(rawCandidateId);
    const input = await parseJson(request, candidateGenerationInput);
    const result = await dependencies.service.regenerateCandidate(periodId, candidateId, input, actor);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function POST(request: Request, context: RouteContext) {
  return handleCandidateRegeneratePost(request, context, getServerApiDependencies());
}
