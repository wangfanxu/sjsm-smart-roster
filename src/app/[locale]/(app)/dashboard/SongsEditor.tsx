"use client";

import { useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import styles from "./dashboard.module.css";
import { getDashboardMessages } from "./messages";
import type { Song } from "./types";

type SongRow = Readonly<{ key: string; title: string; youtubeLink: string }>;

function isValidOptionalUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function useRowKeyFactory() {
  const counter = useRef(0);
  return () => {
    counter.current += 1;
    return `song-${counter.current}`;
  };
}

export function SongsEditor({
  idToken,
  locale,
  serviceId,
  songs,
  songsPrintingLink,
  onClose,
  onSaved,
}: Readonly<{
  idToken: string;
  locale: Locale;
  serviceId: string;
  songs: ReadonlyArray<Song>;
  songsPrintingLink: string | null;
  onClose: () => void;
  onSaved: (result: { songs: ReadonlyArray<Song>; songsPrintingLink: string | null }) => void;
}>) {
  const messages = getDashboardMessages(locale);
  const nextRowKey = useRowKeyFactory();

  const [rows, setRows] = useState<SongRow[]>(() =>
    songs.length > 0
      ? songs.map((song) => ({ key: nextRowKey(), title: song.title, youtubeLink: song.youtubeLink ?? "" }))
      : [{ key: nextRowKey(), title: "", youtubeLink: "" }],
  );
  const [printingLink, setPrintingLink] = useState(songsPrintingLink ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateRow(key: string, patch: Partial<SongRow>) {
    setRows((previous) => previous.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: string) {
    setRows((previous) => previous.filter((row) => row.key !== key));
  }

  function addRow() {
    setRows((previous) => [...previous, { key: nextRowKey(), title: "", youtubeLink: "" }]);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const submittedSongs = rows
      .map((row) => ({ title: row.title.trim(), youtubeLink: row.youtubeLink.trim() }))
      .filter((row) => row.title.length > 0);

    const invalidLink = [...submittedSongs.map((song) => song.youtubeLink), printingLink].some(
      (value) => !isValidOptionalUrl(value),
    );
    if (invalidLink) {
      setError(messages.songsEditorInvalidLink);
      return;
    }

    setSaving(true);
    try {
      const result = await apiFetch<{ songs: Song[]; songsPrintingLink: string | null }>(
        `/services/${serviceId}/songs`,
        idToken,
        {
          method: "PUT",
          body: JSON.stringify({
            songs: submittedSongs.map((song) => ({
              title: song.title,
              youtubeLink: song.youtubeLink || null,
            })),
            songsPrintingLink: printingLink.trim() || null,
          }),
        },
      );
      onSaved(result);
    } catch (submitError) {
      setError(
        submitError instanceof ApiRequestError ? submitError.payload.message : messages.songsEditorError,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.dialogOverlay} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={messages.songsEditorHeading}
        onClick={(event) => event.stopPropagation()}
      >
        <h3>{messages.songsEditorHeading}</h3>
        <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
          <div className={styles.songsEditorRows}>
            {rows.map((row) => (
              <div key={row.key} className={styles.songsEditorRow}>
                <input
                  type="text"
                  aria-label={messages.songsEditorTitleLabel}
                  placeholder={messages.songsEditorTitlePlaceholder}
                  value={row.title}
                  maxLength={200}
                  onChange={(event) => updateRow(row.key, { title: event.target.value })}
                />
                <input
                  type="text"
                  aria-label={messages.songsEditorYoutubeLabel}
                  placeholder={messages.songsEditorYoutubeLabel}
                  value={row.youtubeLink}
                  maxLength={500}
                  onChange={(event) => updateRow(row.key, { youtubeLink: event.target.value })}
                />
                <button
                  type="button"
                  className={styles.retryButton}
                  onClick={() => removeRow(row.key)}
                >
                  {messages.songsEditorRemoveButton}
                </button>
              </div>
            ))}
          </div>
          <button type="button" className={styles.retryButton} onClick={addRow}>
            {messages.songsEditorAddButton}
          </button>

          <div className={styles.formRow}>
            <label htmlFor="songs-printing-link">{messages.songsEditorPrintingLinkLabel}</label>
            <input
              id="songs-printing-link"
              type="text"
              placeholder={messages.songsEditorPrintingLinkPlaceholder}
              value={printingLink}
              maxLength={500}
              onChange={(event) => setPrintingLink(event.target.value)}
            />
          </div>

          {error ? <p className={styles.inlineError}>{error}</p> : null}

          <div className={styles.dialogActions}>
            <button type="button" className={styles.retryButton} onClick={onClose} disabled={saving}>
              {messages.songsEditorCancel}
            </button>
            <button type="submit" className={styles.submitButton} disabled={saving}>
              {saving ? messages.songsEditorSaving : messages.songsEditorSave}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
