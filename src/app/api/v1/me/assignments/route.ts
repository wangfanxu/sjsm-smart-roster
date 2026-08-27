import { authorizeRequest } from "@/auth/authorize";
import { apiErrorResponse } from "@/api/errors";
import { assignmentRangeQuery, searchParamsObject } from "@/api/validation";
import { getServerApiDependencies, type ApiDependencies } from "@/server/api-dependencies";

export const runtime = "nodejs";

export async function handleAssignmentsGet(request: Request, dependencies: ApiDependencies) {
  try {
    const actor = await authorizeRequest(request, "assignment:read:self", dependencies.auth);
    const range = assignmentRangeQuery.parse(searchParamsObject(request));
    const assignments = await dependencies.service.listMyUpcomingAssignments(
      actor.userId,
      range.from ? new Date(range.from) : undefined,
      range.to ? new Date(range.to) : undefined,
    );
    return Response.json({
      assignments,
      message: assignments.length === 0 ? "No upcoming assignments found" : undefined,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function GET(request: Request) {
  return handleAssignmentsGet(request, getServerApiDependencies());
}
