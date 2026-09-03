"use client";

import { useCallback, useReducer, useRef } from "react";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/config";
import { useAuth } from "@/lib/auth-client";
import { ApiRequestError } from "@/lib/api-client";
import { askAssistant, confirmAssistant } from "./assistant-api";
import { chatReducer, initialChatState } from "./chat-state";
import { getAssistantUiMessages } from "./messages";
import { MessageList } from "./MessageList";
import { ConfirmationCard } from "./ConfirmationCard";
import { ChatComposer } from "./ChatComposer";
import styles from "./assistant.module.css";

function createIdFactory() {
  let counter = 0;
  return () => {
    counter += 1;
    return `msg-${counter}-${Date.now()}`;
  };
}

export function AssistantPanel({
  locale,
  onClose,
}: Readonly<{ locale: Locale; onClose?: () => void }>) {
  const navMessages = getMessages(locale);
  const ui = getAssistantUiMessages(locale);

  const { idToken } = useAuth();
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const nextId = useRef(createIdFactory()).current;

  const handleSend = useCallback(
    async (text: string) => {
      if (!idToken || state.isSending) return;

      dispatch({ type: "user_message_sent", id: nextId(), text });
      try {
        const response = await askAssistant(idToken, text);
        dispatch({ type: "ask_succeeded", id: nextId(), response });
      } catch {
        // Covers both network failures and unexpected non-2xx responses.
        // The assistant's own LLM/timeout failures are already handled
        // server-side as a 200 "ambiguous" reply, so anything that lands
        // here is surfaced as a plain retry-me chat message rather than a
        // broken UI state.
        dispatch({ type: "ask_failed", id: nextId(), text: ui.retryError });
      }
    },
    [idToken, state.isSending, nextId, ui.retryError],
  );

  const handleConfirm = useCallback(async () => {
    const pending = state.pending;
    if (!pending || state.isConfirming || !idToken) return;

    // Disable the Confirm button immediately: dispatch synchronously before
    // the network call so a second click (or a second render) can't fire a
    // duplicate confirm for the same pending token.
    dispatch({ type: "confirm_clicked" });

    try {
      const response = await confirmAssistant(idToken, pending.confirmationToken);
      dispatch({ type: "confirm_succeeded", id: nextId(), text: response.message });
    } catch (error) {
      const text = error instanceof ApiRequestError ? error.payload.message : ui.retryError;
      dispatch({ type: "confirm_failed", id: nextId(), text });
    }
  }, [state.pending, state.isConfirming, idToken, nextId, ui.retryError]);

  const handleCancel = useCallback(() => {
    dispatch({ type: "cancel_clicked" });
  }, []);

  return (
    <section className={onClose ? `${styles.panel} ${styles.panelFloating}` : styles.panel}>
      <div className={styles.panelHeader}>
        <h1 className={styles.heading}>{navMessages.navAssistant}</h1>
        {onClose ? (
          <button
            type="button"
            className={styles.closeButton}
            aria-label={navMessages.closeAssistant}
            onClick={onClose}
          >
            <span aria-hidden="true">&times;</span>
          </button>
        ) : null}
      </div>
      <MessageList
        messages={state.messages}
        isSending={state.isSending}
        thinkingText={ui.thinking}
        emptyHint={ui.emptyStateHint}
      />
      {state.pending ? (
        <ConfirmationCard
          pendingServiceDate={state.pending.pendingServiceDate}
          locale={state.pending.locale}
          confirming={state.isConfirming}
          onConfirm={() => void handleConfirm()}
          onCancel={handleCancel}
        />
      ) : null}
      <ChatComposer
        disabled={state.isSending || !idToken}
        placeholder={ui.inputPlaceholder}
        inputLabel={ui.inputLabel}
        sendLabel={ui.sendButton}
        onSend={(text) => void handleSend(text)}
      />
    </section>
  );
}
