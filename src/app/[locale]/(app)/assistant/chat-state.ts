import type { AskAssistantResponse, AssistantLocale } from "./assistant-api";

export type ChatRole = "user" | "assistant";

export type ChatMessage = Readonly<{
  id: string;
  role: ChatRole;
  text: string;
}>;

export type PendingConfirmation = Readonly<{
  confirmationToken: string;
  pendingServiceDate: string;
  locale: AssistantLocale;
}>;

export type ChatState = Readonly<{
  messages: readonly ChatMessage[];
  pending: PendingConfirmation | null;
  isSending: boolean;
  isConfirming: boolean;
}>;

export const initialChatState: ChatState = {
  messages: [],
  pending: null,
  isSending: false,
  isConfirming: false,
};

export type ChatAction =
  | { type: "user_message_sent"; id: string; text: string }
  | { type: "ask_succeeded"; id: string; response: AskAssistantResponse }
  | { type: "ask_failed"; id: string; text: string }
  | { type: "confirm_clicked" }
  | { type: "confirm_succeeded"; id: string; text: string }
  | { type: "confirm_failed"; id: string; text: string }
  | { type: "cancel_clicked" };

function appendAssistantMessage(
  state: ChatState,
  id: string,
  text: string,
): readonly ChatMessage[] {
  return [...state.messages, { id, role: "assistant", text }];
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "user_message_sent":
      return {
        ...state,
        isSending: true,
        messages: [...state.messages, { id: action.id, role: "user", text: action.text }],
      };

    case "ask_succeeded": {
      const { response } = action;
      const nextPending: PendingConfirmation | null =
        response.intent === "prepare_mark_unavailable" && response.confirmationToken
          ? {
              confirmationToken: response.confirmationToken,
              pendingServiceDate: response.pendingServiceDate ?? "",
              locale: response.locale,
            }
          : null;
      return {
        ...state,
        isSending: false,
        pending: nextPending,
        messages: appendAssistantMessage(state, action.id, response.message),
      };
    }

    case "ask_failed":
      return {
        ...state,
        isSending: false,
        messages: appendAssistantMessage(state, action.id, action.text),
      };

    case "confirm_clicked":
      // Guards against a stale/duplicate confirm: no pending confirmation left to
      // act on, or a confirm request is already in flight for this one.
      if (!state.pending || state.isConfirming) return state;
      return { ...state, isConfirming: true };

    case "confirm_succeeded":
      return {
        ...state,
        isConfirming: false,
        pending: null,
        messages: appendAssistantMessage(state, action.id, action.text),
      };

    case "confirm_failed":
      return {
        ...state,
        isConfirming: false,
        pending: null,
        messages: appendAssistantMessage(state, action.id, action.text),
      };

    case "cancel_clicked":
      // Client-side only: not confirming a prepared write IS the cancellation.
      // There is no confirm/cancel endpoint to call.
      return { ...state, pending: null };

    default:
      return state;
  }
}
