"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/config";
import { AssistantPanel } from "./AssistantPanel";
import styles from "./floating-assistant.module.css";

export function FloatingAssistantButton({ locale }: Readonly<{ locale: Locale }>) {
  const messages = getMessages(locale);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        className={styles.fab}
        aria-label={messages.openAssistant}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="26"
          height="26"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </button>
      {open ? (
        <div className={styles.overlay} role="presentation" onClick={close}>
          <div
            className={styles.popover}
            role="dialog"
            aria-modal="true"
            aria-label={messages.navAssistant}
            onClick={(event) => event.stopPropagation()}
          >
            <AssistantPanel locale={locale} onClose={close} />
          </div>
        </div>
      ) : null}
    </>
  );
}
