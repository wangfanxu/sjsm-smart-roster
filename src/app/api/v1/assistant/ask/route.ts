import { apiErrorResponse } from "@/api/errors";
import { assistantAskInput, parseJson } from "@/api/validation";
import { authorizeRequest } from "@/auth/authorize";
import {
  getServerApiDependencies,
  type ApiDependencies,
} from "@/server/api-dependencies";

export const runtime = "nodejs";

export async function handleAssistantAskPost(request: Request, dependencies: ApiDependencies) {
  try {
    const actor = await authorizeRequest(request, "assignment:read:self", dependencies.auth);
    const input = await parseJson(request, assistantAskInput);
    const reply = await dependencies.assistant.ask(input.message, actor);
    return Response.json(reply);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function POST(request: Request) {
  return handleAssistantAskPost(request, getServerApiDependencies());
}
