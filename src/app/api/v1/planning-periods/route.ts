import { authorizeRequest } from "@/auth/authorize";
import { apiErrorResponse } from "@/api/errors";
import { parseJson, planningPeriodInput } from "@/api/validation";
import { getServerApiDependencies, type ApiDependencies } from "@/server/api-dependencies";

export const runtime = "nodejs";

export async function handlePlanningPeriodsGet(request: Request, dependencies: ApiDependencies) {
  try {
    await authorizeRequest(request, "profile:read:self", dependencies.auth);
    return Response.json({ planningPeriods: await dependencies.service.listPlanningPeriods() });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function handlePlanningPeriodsPost(request: Request, dependencies: ApiDependencies) {
  try {
    const actor = await authorizeRequest(request, "planning:manage", dependencies.auth);
    const input = await parseJson(request, planningPeriodInput);
    const planningPeriod = await dependencies.service.createPlanningPeriod(input, actor);
    return Response.json({ planningPeriod }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function GET(request: Request) {
  return handlePlanningPeriodsGet(request, getServerApiDependencies());
}

export function POST(request: Request) {
  return handlePlanningPeriodsPost(request, getServerApiDependencies());
}
