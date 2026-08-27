import { authorizeRequest } from "@/auth/authorize";
import { apiErrorResponse } from "@/api/errors";
import {
  availabilityInput,
  dateRangeQuery,
  parseJson,
  searchParamsObject,
} from "@/api/validation";
import { getServerApiDependencies, type ApiDependencies } from "@/server/api-dependencies";

export const runtime = "nodejs";

export async function handleAvailabilityGet(request: Request, dependencies: ApiDependencies) {
  try {
    const actor = await authorizeRequest(request, "availability:read:self", dependencies.auth);
    const range = dateRangeQuery.parse(searchParamsObject(request));
    const availability = await dependencies.service.listMyAvailability(actor.userId, range);
    return Response.json({ availability });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function handleAvailabilityPut(request: Request, dependencies: ApiDependencies) {
  try {
    const actor = await authorizeRequest(request, "availability:write:self", dependencies.auth);
    const input = await parseJson(request, availabilityInput);
    const availability = await dependencies.service.setMyAvailability(actor.userId, input);
    return Response.json({ availability });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function GET(request: Request) {
  return handleAvailabilityGet(request, getServerApiDependencies());
}

export function PUT(request: Request) {
  return handleAvailabilityPut(request, getServerApiDependencies());
}
