"use client";

import { useState, type FormEvent } from "react";
import styles from "./assistant.module.css";

export function ChatComposer({
  disabled,
  placeholder,
  inputLabel,
  sendLabel,
  onSend,
}: Readonly<{
  disabled: boolean;
  placeholder: string;
  inputLabel: string;
  sendLabel: string;
  onSend: (text: string) => void;
}>) {
  const [draft, setDraft] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setDraft("");
  };

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      <input
        className={styles.composerInput}
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        aria-label={inputLabel}
        disabled={disabled}
      />
      <button type="submit" className={styles.sendButton} disabled={disabled || draft.trim().length === 0}>
        {sendLabel}
      </button>
    </form>
  );
}
