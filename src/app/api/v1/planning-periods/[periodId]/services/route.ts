import { authorizeRequest } from "@/auth/authorize";
import { apiErrorResponse } from "@/api/errors";
import { parseJson, serviceInput, uuidParameter } from "@/api/validation";
import { getServerApiDependencies, type ApiDependencies } from "@/server/api-dependencies";

export const runtime = "nodejs";

type RouteContext = Readonly<{ params: Promise<{ periodId: string }> }>;

export async function handleServicesGet(
  request: Request,
  context: RouteContext,
  dependencies: ApiDependencies,
) {
  try {
    await authorizeRequest(request, "profile:read:self", dependencies.auth);
    const periodId = uuidParameter.parse((await context.params).periodId);
    return Response.json({ services: await dependencies.service.listServices(periodId) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function handleServicesPost(
  request: Request,
  context: RouteContext,
  dependencies: ApiDependencies,
) {
  try {
    const actor = await authorizeRequest(request, "planning:manage", dependencies.auth);
    const periodId = uuidParameter.parse((await context.params).periodId);
    const input = await parseJson(request, serviceInput);
    const service = await dependencies.service.createService(
      { ...input, planningPeriodId: periodId, startsAt: new Date(input.startsAt) },
      actor,
    );
    return Response.json({ service }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function GET(request: Request, context: RouteContext) {
  return handleServicesGet(request, context, getServerApiDependencies());
}

export function POST(request: Request, context: RouteContext) {
  return handleServicesPost(request, context, getServerApiDependencies());
}
