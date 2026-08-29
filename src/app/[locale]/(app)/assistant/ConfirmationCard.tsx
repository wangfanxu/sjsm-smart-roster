"use client";

import type { AssistantLocale } from "./assistant-api";
import { getAssistantUiMessages } from "./messages";
import styles from "./assistant.module.css";

/**
 * The confirmation UI required by the acceptance criteria: a
 * `prepare_mark_unavailable` reply must be shown as a distinct card with
 * the parsed date and explicit Confirm/Cancel controls, not left for the
 * user to interpret from a plain chat bubble. Nothing is written until
 * Confirm is pressed; Cancel just discards this card locally.
 */
export function ConfirmationCard({
  pendingServiceDate,
  locale,
  confirming,
  onConfirm,
  onCancel,
}: Readonly<{
  pendingServiceDate: string;
  locale: AssistantLocale;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}>) {
  const ui = getAssistantUiMessages(locale);

  return (
    <div className={styles.confirmationCard} role="alert">
      <p className={styles.confirmationHeading}>{ui.confirmationHeading}</p>
      <p className={styles.confirmationDate}>
        <span>{ui.confirmationDateLabel}: </span>
        {pendingServiceDate}
      </p>
      <div className={styles.confirmationActions}>
        <button
          type="button"
          className={styles.confirmButton}
          onClick={onConfirm}
          disabled={confirming}
        >
          {confirming ? ui.confirming : ui.confirmButton}
        </button>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
          disabled={confirming}
        >
          {ui.cancelButton}
        </button>
      </div>
    </div>
  );
}
