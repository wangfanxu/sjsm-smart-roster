import { apiErrorResponse } from "@/api/errors";
import { parseJson, serviceSongsInput, uuidParameter } from "@/api/validation";
import { authorizeRequest } from "@/auth/authorize";
import { getServerApiDependencies, type ApiDependencies } from "@/server/api-dependencies";

export const runtime = "nodejs";

type RouteContext = Readonly<{ params: Promise<{ serviceId: string }> }>;

export async function handleServiceSongsPut(
  request: Request,
  context: RouteContext,
  dependencies: ApiDependencies,
) {
  try {
    const actor = await authorizeRequest(request, "songs:manage", dependencies.auth);
    const serviceId = uuidParameter.parse((await context.params).serviceId);
    const input = await parseJson(request, serviceSongsInput);
    const result = await dependencies.service.updateServiceSongs(serviceId, input, actor);
    return Response.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function PUT(request: Request, context: RouteContext) {
  return handleServiceSongsPut(request, context, getServerApiDependencies());
}
