"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/i18n/config";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import styles from "./dashboard.module.css";
import { formatCalendarDate, isPastDate, todayIsoDate } from "./date-utils";
import { getDashboardMessages } from "./messages";
import type { AvailabilityEntry, AvailabilityStatus } from "./types";

type AvailabilityListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; entries: readonly AvailabilityEntry[] };

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success" }
  | { status: "error"; message: string };

const statusBadgeClassName: Record<AvailabilityStatus, string> = {
  available: styles.statusAvailable,
  unavailable: styles.statusUnavailable,
  preferred: styles.statusPreferred,
};

function sortByServiceDate(entries: readonly AvailabilityEntry[]): AvailabilityEntry[] {
  return [...entries].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));
}

export function AvailabilitySection({
  idToken,
  locale,
}: Readonly<{ idToken: string; locale: Locale }>) {
  const messages = getDashboardMessages(locale);
  const today = useMemo(() => todayIsoDate(), []);

  const [listState, setListState] = useState<AvailabilityListState>({ status: "loading" });
  const [reloadToken, setReloadToken] = useState(0);

  const [selectedDate, setSelectedDate] = useState(today);
  const [status, setStatus] = useState<AvailabilityStatus>("available");
  const [note, setNote] = useState("");
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  // Tracks which (date, list-fetch outcome) pair the form fields were last
  // derived from, so the form can re-sync when the selected date changes or
  // the availability list finishes loading, without overwriting the
  // volunteer's in-progress edits on every render.
  const [syncedWith, setSyncedWith] = useState(`${selectedDate}|${listState.status}`);
  const currentSyncKey = `${selectedDate}|${listState.status}`;
  if (currentSyncKey !== syncedWith) {
    setSyncedWith(currentSyncKey);
    const existing =
      listState.status === "ready"
        ? listState.entries.find((entry) => entry.serviceDate === selectedDate)
        : undefined;
    setStatus(existing?.status ?? "available");
    setNote(existing?.note ?? "");
  }

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ availability: AvailabilityEntry[] }>("/me/availability", idToken)
      .then((response) => {
        if (cancelled) return;
        setListState({ status: "ready", entries: sortByServiceDate(response.availability) });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof ApiRequestError ? error.payload.message : messages.availabilityErrorTitle;
        setListState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, [idToken, reloadToken, messages.availabilityErrorTitle]);

  const selectedDateIsPast = isPastDate(selectedDate, today);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedDateIsPast) return;

    setSaveState({ status: "saving" });
    try {
      const response = await apiFetch<{ availability: AvailabilityEntry }>("/me/availability", idToken, {
        method: "PUT",
        body: JSON.stringify({
          serviceDate: selectedDate,
          status,
          note: note.trim().length > 0 ? note.trim() : undefined,
        }),
      });
      setSaveState({ status: "success" });
      setListState((current) => {
        if (current.status !== "ready") return current;
        const withoutSelected = current.entries.filter(
          (entry) => entry.serviceDate !== response.availability.serviceDate,
        );
        return { status: "ready", entries: sortByServiceDate([...withoutSelected, response.availability]) };
      });
    } catch (error) {
      const message =
        error instanceof ApiRequestError ? error.payload.message : messages.availabilitySaveErrorTitle;
      setSaveState({ status: "error", message });
    }
  };

  return (
    <section className={styles.panel} aria-labelledby="availability-heading">
      <h2 id="availability-heading">{messages.availabilityTitle}</h2>
      <p className={styles.panelDescription}>{messages.availabilityDescription}</p>

      {listState.status === "loading" ? (
        <p className={styles.statusMessage}>{messages.availabilityLoading}</p>
      ) : null}

      {listState.status === "error" ? (
        <div className={styles.errorBox} role="alert">
          <span>{listState.message || messages.availabilityErrorTitle}</span>
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => {
              setListState({ status: "loading" });
              setReloadToken((token) => token + 1);
            }}
          >
            {messages.availabilityRetry}
          </button>
        </div>
      ) : null}

      {listState.status === "ready" ? (
        <div>
          <h3>{messages.availabilityListTitle}</h3>
          {listState.entries.length === 0 ? (
            <p className={styles.statusMessage}>{messages.availabilityListEmpty}</p>
          ) : (
            <ul className={styles.availabilityList}>
              {listState.entries.map((entry) => (
                <li key={entry.serviceDate} className={styles.availabilityRow}>
                  <span className={styles.availabilityDate}>
                    {formatCalendarDate(entry.serviceDate, locale)}
                  </span>
                  <span className={`${styles.statusBadge} ${statusBadgeClassName[entry.status]}`}>
                    {messages.availabilityStatusOptions[entry.status]}
                  </span>
                  {entry.note ? (
                    <span className={styles.availabilityNote}>
                      {messages.availabilityNoteLabel}: {entry.note}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
        <h3>{messages.availabilityFormTitle}</h3>

        <div className={styles.formRow}>
          <label htmlFor="availability-date">{messages.availabilityDateLabel}</label>
          <input
            id="availability-date"
            type="date"
            min={today}
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            aria-describedby={selectedDateIsPast ? "availability-past-date-message" : undefined}
            aria-invalid={selectedDateIsPast}
            required
          />
          {selectedDateIsPast ? (
            <p id="availability-past-date-message" className={styles.inlineError}>
              {messages.availabilityPastDateMessage}
            </p>
          ) : null}
        </div>

        <div className={styles.formRow}>
          <label htmlFor="availability-status">{messages.availabilityStatusLabel}</label>
          <select
            id="availability-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as AvailabilityStatus)}
          >
            <option value="available">{messages.availabilityStatusOptions.available}</option>
            <option value="preferred">{messages.availabilityStatusOptions.preferred}</option>
            <option value="unavailable">{messages.availabilityStatusOptions.unavailable}</option>
          </select>
        </div>

        <div className={styles.formRow}>
          <label htmlFor="availability-note">{messages.availabilityNoteInputLabel}</label>
          <input
            id="availability-note"
            type="text"
            maxLength={500}
            placeholder={messages.availabilityNoteInputPlaceholder}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        {saveState.status === "error" ? (
          <div className={styles.errorBox} role="alert">
            <span>{saveState.message}</span>
          </div>
        ) : null}

        {saveState.status === "success" ? (
          <p className={styles.successMessage}>{messages.availabilitySaveSuccess}</p>
        ) : null}

        <button
          type="submit"
          className={styles.submitButton}
          disabled={selectedDateIsPast || saveState.status === "saving"}
        >
          {saveState.status === "saving" ? messages.availabilitySubmitting : messages.availabilitySubmit}
        </button>
      </form>
    </section>
  );
}
