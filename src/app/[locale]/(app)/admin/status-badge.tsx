import type { AdminMessages } from "./messages";
import type { CandidateStatus } from "./types";
import styles from "./admin.module.css";

export function StatusBadge({
  status,
  messages,
}: Readonly<{ status: CandidateStatus; messages: AdminMessages }>) {
  const label =
    status === "draft"
      ? messages.statusDraft
      : status === "published"
        ? messages.statusPublished
        : messages.statusSuperseded;
  const variant =
    status === "draft" ? styles.badgeDraft : status === "published" ? styles.badgePublished : styles.badgeSuperseded;

  return <span className={`${styles.badge} ${variant}`}>{label}</span>;
}
