"use client";

import { useState } from "react";
import type { Locale } from "@/i18n/config";
import styles from "./dashboard.module.css";
import { getDashboardMessages } from "./messages";

export function WhatsAppMessageDialog({
  locale,
  message,
  onClose,
}: Readonly<{ locale: Locale; message: string; onClose: () => void }>) {
  const messages = getDashboardMessages(locale);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    setTimeout(() => setCopyState("idle"), 3000);
  }

  return (
    <div className={styles.dialogOverlay} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={messages.whatsappDialogHeading}
        onClick={(event) => event.stopPropagation()}
      >
        <h3>{messages.whatsappDialogHeading}</h3>
        <p>{messages.whatsappDialogIntro}</p>
        <pre className={styles.whatsappMessageBox}>{message}</pre>
        {copyState === "error" ? <p className={styles.inlineError}>{messages.whatsappCopyError}</p> : null}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.retryButton} onClick={onClose}>
            {messages.whatsappCloseButton}
          </button>
          <button type="button" className={styles.submitButton} onClick={() => void handleCopy()}>
            {copyState === "copied" ? messages.whatsappCopiedButton : messages.whatsappCopyButton}
          </button>
        </div>
      </div>
    </div>
  );
}
