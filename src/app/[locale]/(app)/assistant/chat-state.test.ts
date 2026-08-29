import { describe, expect, it } from "vitest";
import type { AskAssistantResponse } from "./assistant-api";
import { chatReducer, initialChatState, type ChatState } from "./chat-state";

function askResponse(overrides: Partial<AskAssistantResponse> = {}): AskAssistantResponse {
  return {
    intent: "get_my_next_assignment",
    locale: "en",
    message: "Your next assignment is Worship Service on 2026-09-05.",
    assignment: null,
    confirmationToken: null,
    pendingServiceDate: null,
    ...overrides,
  };
}

describe("chatReducer", () => {
  it("appends a user bubble and marks the chat as sending", () => {
    const state = chatReducer(initialChatState, {
      type: "user_message_sent",
      id: "u1",
      text: "When do I serve next?",
    });

    expect(state.isSending).toBe(true);
    expect(state.messages).toEqual([{ id: "u1", role: "user", text: "When do I serve next?" }]);
  });

  it("renders a get_my_next_assignment reply without opening a confirmation card", () => {
    const state = chatReducer(initialChatState, {
      type: "ask_succeeded",
      id: "a1",
      response: askResponse(),
    });

    expect(state.isSending).toBe(false);
    expect(state.pending).toBeNull();
    expect(state.messages).toEqual([
      { id: "a1", role: "assistant", text: "Your next assignment is Worship Service on 2026-09-05." },
    ]);
  });

  it("renders ambiguous and unsupported replies as plain assistant messages", () => {
    for (const intent of ["ambiguous", "unsupported"] as const) {
      const state = chatReducer(initialChatState, {
        type: "ask_succeeded",
        id: "a1",
        response: askResponse({ intent, message: "I did not understand that." }),
      });
      expect(state.pending).toBeNull();
      expect(state.messages[0]?.text).toBe("I did not understand that.");
    }
  });

  it("opens a confirmation card for a prepare_mark_unavailable reply with a token", () => {
    const state = chatReducer(initialChatState, {
      type: "ask_succeeded",
      id: "a1",
      response: askResponse({
        intent: "prepare_mark_unavailable",
        message: "You want to mark yourself unavailable on 2026-09-20.",
        confirmationToken: "signed-token",
        pendingServiceDate: "2026-09-20",
        locale: "en",
      }),
    });

    expect(state.pending).toEqual({
      confirmationToken: "signed-token",
      pendingServiceDate: "2026-09-20",
      locale: "en",
    });
  });

  it("treats a prepare_mark_unavailable reply with no token like an ambiguous reply", () => {
    const state = chatReducer(initialChatState, {
      type: "ask_succeeded",
      id: "a1",
      response: askResponse({
        intent: "prepare_mark_unavailable",
        message: "Which date did you mean?",
        confirmationToken: null,
        pendingServiceDate: null,
      }),
    });

    expect(state.pending).toBeNull();
    expect(state.messages[0]?.text).toBe("Which date did you mean?");
  });

  it("appends a retry message on ask failure without touching pending state", () => {
    const state = chatReducer(initialChatState, {
      type: "ask_failed",
      id: "a1",
      text: "Please try again.",
    });

    expect(state.isSending).toBe(false);
    expect(state.pending).toBeNull();
    expect(state.messages[0]?.text).toBe("Please try again.");
  });

  const stateWithPending: ChatState = {
    ...initialChatState,
    pending: { confirmationToken: "tok", pendingServiceDate: "2026-09-20", locale: "en" },
  };

  it("marks confirming on confirm_clicked when a pending confirmation exists", () => {
    const state = chatReducer(stateWithPending, { type: "confirm_clicked" });
    expect(state.isConfirming).toBe(true);
  });

  it("ignores confirm_clicked when there is no pending confirmation", () => {
    const state = chatReducer(initialChatState, { type: "confirm_clicked" });
    expect(state).toBe(initialChatState);
  });

  it("ignores a duplicate confirm_clicked while a confirm is already in flight", () => {
    const confirming = chatReducer(stateWithPending, { type: "confirm_clicked" });
    const stillConfirming = chatReducer(confirming, { type: "confirm_clicked" });
    expect(stillConfirming).toBe(confirming);
  });

  it("clears the pending confirmation and shows the final message on confirm_succeeded", () => {
    const confirming = chatReducer(stateWithPending, { type: "confirm_clicked" });
    const state = chatReducer(confirming, {
      type: "confirm_succeeded",
      id: "c1",
      text: "Done — you're marked unavailable on 2026-09-20.",
    });

    expect(state.pending).toBeNull();
    expect(state.isConfirming).toBe(false);
    expect(state.messages[0]?.text).toBe("Done — you're marked unavailable on 2026-09-20.");
  });

  it("clears the pending confirmation and shows the server error on confirm_failed", () => {
    const confirming = chatReducer(stateWithPending, { type: "confirm_clicked" });
    const state = chatReducer(confirming, {
      type: "confirm_failed",
      id: "c1",
      text: "This confirmation has expired.",
    });

    expect(state.pending).toBeNull();
    expect(state.isConfirming).toBe(false);
    expect(state.messages[0]?.text).toBe("This confirmation has expired.");
  });

  it("discards a pending confirmation on cancel without any messages or API calls", () => {
    const state = chatReducer(stateWithPending, { type: "cancel_clicked" });
    expect(state.pending).toBeNull();
    expect(state.messages).toEqual([]);
  });
});
