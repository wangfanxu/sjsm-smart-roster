import { authorizeRequest } from "@/auth/authorize";
import { apiErrorResponse } from "@/api/errors";
import { parseJson, serviceInput, uuidParameter } from "@/api/validation";
import { getServerApiDependencies, type ApiDependencies } from "@/server/api-dependencies";

export const runtime = "nodejs";

type RouteContext = Readonly<{ params: Promise<{ periodId: string; serviceId: string }> }>;

export async function handleServicePatch(
  request: Request,
  context: RouteContext,
  dependencies: ApiDependencies,
) {
  try {
    const actor = await authorizeRequest(request, "planning:manage", dependencies.auth);
    const { periodId: rawPeriodId, serviceId: rawServiceId } = await context.params;
    const periodId = uuidParameter.parse(rawPeriodId);
    const serviceId = uuidParameter.parse(rawServiceId);
    const input = await parseJson(request, serviceInput);
    const service = await dependencies.service.updateService(
      periodId,
      serviceId,
      { ...input, startsAt: new Date(input.startsAt) },
      actor,
    );
    return Response.json({ service });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function handleServiceDelete(
  request: Request,
  context: RouteContext,
  dependencies: ApiDependencies,
) {
  try {
    const actor = await authorizeRequest(request, "planning:manage", dependencies.auth);
    const { periodId: rawPeriodId, serviceId: rawServiceId } = await context.params;
    const periodId = uuidParameter.parse(rawPeriodId);
    const serviceId = uuidParameter.parse(rawServiceId);
    const result = await dependencies.service.deleteService(periodId, serviceId, actor);
    return Response.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function PATCH(request: Request, context: RouteContext) {
  return handleServicePatch(request, context, getServerApiDependencies());
}

export function DELETE(request: Request, context: RouteContext) {
  return handleServiceDelete(request, context, getServerApiDependencies());
}
