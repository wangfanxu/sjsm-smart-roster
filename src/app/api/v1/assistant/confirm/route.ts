import { apiErrorResponse } from "@/api/errors";
import { assistantConfirmInput, parseJson } from "@/api/validation";
import { authorizeRequest } from "@/auth/authorize";
import {
  getServerApiDependencies,
  type ApiDependencies,
} from "@/server/api-dependencies";

export const runtime = "nodejs";

export async function handleAssistantConfirmPost(request: Request, dependencies: ApiDependencies) {
  try {
    const actor = await authorizeRequest(request, "availability:write:self", dependencies.auth);
    const input = await parseJson(request, assistantConfirmInput);
    const reply = await dependencies.assistant.confirm(input.confirmationToken, actor);
    return Response.json(reply);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function POST(request: Request) {
  return handleAssistantConfirmPost(request, getServerApiDependencies());
}
