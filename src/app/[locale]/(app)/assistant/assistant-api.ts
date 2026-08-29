import { apiFetch } from "@/lib/api-client";

export type AssistantLocale = "en" | "zh";

export type AssistantIntent =
  | "get_my_next_assignment"
  | "prepare_mark_unavailable"
  | "unsupported"
  | "ambiguous";

export type AssistantAssignment = Readonly<{
  assignmentId: string;
  serviceId: string;
  serviceDate: string;
  serviceTime: string;
  title: string;
  role: string;
}>;

export type AskAssistantResponse = Readonly<{
  intent: AssistantIntent;
  locale: AssistantLocale;
  message: string;
  assignment: AssistantAssignment | null;
  confirmationToken: string | null;
  pendingServiceDate: string | null;
}>;

export type ConfirmAssistantResponse = Readonly<{
  locale: AssistantLocale;
  message: string;
  serviceDate: string;
}>;

export function askAssistant(idToken: string, message: string): Promise<AskAssistantResponse> {
  return apiFetch<AskAssistantResponse>("/assistant/ask", idToken, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export function confirmAssistant(
  idToken: string,
  confirmationToken: string,
): Promise<ConfirmAssistantResponse> {
  return apiFetch<ConfirmAssistantResponse>("/assistant/confirm", idToken, {
    method: "POST",
    body: JSON.stringify({ confirmationToken }),
  });
}
