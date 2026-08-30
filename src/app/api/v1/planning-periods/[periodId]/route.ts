import { authorizeRequest } from "@/auth/authorize";
import { apiErrorResponse } from "@/api/errors";
import { parseJson, planningPeriodInput, uuidParameter } from "@/api/validation";
import { getServerApiDependencies, type ApiDependencies } from "@/server/api-dependencies";

export const runtime = "nodejs";

type RouteContext = Readonly<{ params: Promise<{ periodId: string }> }>;

export async function handlePlanningPeriodPatch(
  request: Request,
  context: RouteContext,
  dependencies: ApiDependencies,
) {
  try {
    const actor = await authorizeRequest(request, "planning:manage", dependencies.auth);
    const periodId = uuidParameter.parse((await context.params).periodId);
    const input = await parseJson(request, planningPeriodInput);
    const planningPeriod = await dependencies.service.updatePlanningPeriod(periodId, input, actor);
    return Response.json({ planningPeriod });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function handlePlanningPeriodDelete(
  request: Request,
  context: RouteContext,
  dependencies: ApiDependencies,
) {
  try {
    const actor = await authorizeRequest(request, "planning:manage", dependencies.auth);
    const periodId = uuidParameter.parse((await context.params).periodId);
    const result = await dependencies.service.deletePlanningPeriod(periodId, actor);
    return Response.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function PATCH(request: Request, context: RouteContext) {
  return handlePlanningPeriodPatch(request, context, getServerApiDependencies());
}

export function DELETE(request: Request, context: RouteContext) {
  return handlePlanningPeriodDelete(request, context, getServerApiDependencies());
}
