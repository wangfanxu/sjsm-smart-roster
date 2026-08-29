"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "./chat-state";
import styles from "./assistant.module.css";

export function MessageList({
  messages,
  isSending,
  thinkingText,
  emptyHint,
}: Readonly<{
  messages: readonly ChatMessage[];
  isSending: boolean;
  thinkingText: string;
  emptyHint: string;
}>) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, isSending]);

  return (
    <div className={styles.messageList} role="log" aria-live="polite">
      {messages.length === 0 && !isSending ? <p className={styles.emptyHint}>{emptyHint}</p> : null}
      {messages.map((message) => (
        <p
          key={message.id}
          className={`${styles.message} ${
            message.role === "user" ? styles.messageUser : styles.messageAssistant
          }`}
        >
          {message.text}
        </p>
      ))}
      {isSending ? <p className={styles.thinking}>{thinkingText}</p> : null}
      <div ref={bottomRef} />
    </div>
  );
}
