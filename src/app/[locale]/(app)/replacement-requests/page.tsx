"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { isLocale, type Locale } from "@/i18n/config";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-client";
import { getReplacementRequestsMessages, statusLabel } from "./messages";
import styles from "./replacement-requests.module.css";
import type { EligibleReplacement, ReplacementRequestSummary } from "./types";

type LoadState = "loading" | "ready" | "error";
type EligibleState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; eligibleUsers: EligibleReplacement[] };

function badgeClassName(styles_: typeof styles, status: ReplacementRequestSummary["status"]): string {
  if (status === "approved") return styles_.badgeApproved;
  if (status === "declined") return styles_.badgeDeclined;
  if (status === "cancelled") return styles_.badgeCancelled;
  return styles_.badgeOpen;
}

function formatServiceDateTime(isoValue: string, locale: Locale): string {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return isoValue;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-SG", {
    timeZone: "Asia/Singapore",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function ReplacementRequestsPage() {
  const params = useParams<{ locale: string }>();
  const locale: Locale = isLocale(params.locale) ? params.locale : "en";
  const messages = getReplacementRequestsMessages(locale);
  const { status, profile, idToken } = useAuth();
  const router = useRouter();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [requests, setRequests] = useState<ReplacementRequestSummary[]>([]);

  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [eligibleState, setEligibleState] = useState<EligibleState | null>(null);
  const [selectedReplacementId, setSelectedReplacementId] = useState("");
  const [actingRequestId, setActingRequestId] = useState<string | null>(null);
  const [actionErrorByRequest, setActionErrorByRequest] = useState<Record<string, string>>({});

  useEffect(() => {
    if (status === "ready" && profile && profile.systemRole === "volunteer") {
      router.replace(`/${locale}/dashboard`);
    }
  }, [status, profile, locale, router]);

  const load = useCallback(async () => {
    if (!idToken) return;
    try {
      const response = await apiFetch<{ replacementRequests: ReplacementRequestSummary[] }>(
        "/replacement-requests",
        idToken,
      );
      setRequests([...response.replacementRequests]);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [idToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function retryLoad() {
    setLoadState("loading");
    void load();
  }

  async function openReview(requestId: string) {
    setReviewingRequestId(requestId);
    setSelectedReplacementId("");
    setEligibleState({ status: "loading" });
    if (!idToken) return;
    try {
      const response = await apiFetch<{ eligibleUsers: EligibleReplacement[] }>(
        `/replacement-requests/${requestId}/eligible-users`,
        idToken,
      );
      setEligibleState({ status: "ready", eligibleUsers: [...response.eligibleUsers] });
    } catch {
      setEligibleState({ status: "error" });
    }
  }

  function closeReview() {
    setReviewingRequestId(null);
    setEligibleState(null);
  }

  async function handleApprove(requestId: string) {
    if (!idToken || !selectedReplacementId) return;
    setActingRequestId(requestId);
    setActionErrorByRequest((previous) => ({ ...previous, [requestId]: "" }));
    try {
      const { replacementRequest } = await apiFetch<{ replacementRequest: ReplacementRequestSummary }>(
        `/replacement-requests/${requestId}/approve`,
        idToken,
        { method: "POST", body: JSON.stringify({ replacementUserId: selectedReplacementId }) },
      );
      setRequests((previous) =>
        previous.map((entry) => (entry.id === requestId ? replacementRequest : entry)),
      );
      closeReview();
    } catch {
      setActionErrorByRequest((previous) => ({ ...previous, [requestId]: messages.approveError }));
    } finally {
      setActingRequestId(null);
    }
  }

  async function handleDecline(requestId: string) {
    if (!idToken) return;
    setActingRequestId(requestId);
    setActionErrorByRequest((previous) => ({ ...previous, [requestId]: "" }));
    try {
      const { replacementRequest } = await apiFetch<{ replacementRequest: ReplacementRequestSummary }>(
        `/replacement-requests/${requestId}/decline`,
        idToken,
        { method: "POST" },
      );
      setRequests((previous) =>
        previous.map((entry) => (entry.id === requestId ? replacementRequest : entry)),
      );
      if (reviewingRequestId === requestId) closeReview();
    } catch {
      setActionErrorByRequest((previous) => ({ ...previous, [requestId]: messages.declineError }));
    } finally {
      setActingRequestId(null);
    }
  }

  if (status !== "ready" || !profile || profile.systemRole === "volunteer" || !idToken) {
    return null;
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1>{messages.pageTitle}</h1>
        <p>{messages.pageDescription}</p>
      </header>

      <section className={styles.panel}>
        {loadState === "loading" ? <p className={styles.statusMessage}>{messages.loading}</p> : null}

        {loadState === "error" ? (
          <div className={styles.errorBox} role="alert">
            <span>{messages.loadError}</span>
            <button type="button" className={styles.retryButton} onClick={retryLoad}>
              {messages.retry}
            </button>
          </div>
        ) : null}

        {loadState === "ready" && requests.length === 0 ? (
          <p className={styles.emptyState}>{messages.emptyState}</p>
        ) : null}

        {loadState === "ready" && requests.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{messages.columnRequester}</th>
                <th>{messages.columnService}</th>
                <th>{messages.columnRole}</th>
                <th>{messages.columnReason}</th>
                <th>{messages.columnStatus}</th>
                <th>{messages.columnActions}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.requesterDisplayName}</td>
                  <td>
                    {entry.serviceTitle} · {formatServiceDateTime(entry.serviceStartsAt, locale)}
                  </td>
                  <td>{entry.roleName}</td>
                  <td>{entry.reason ?? messages.noReason}</td>
                  <td>
                    <span className={`${styles.badge} ${badgeClassName(styles, entry.status)}`}>
                      {statusLabel(entry.status, messages)}
                    </span>
                    {entry.status === "approved" && entry.replacementDisplayName ? (
                      <p className={styles.hint}>
                        {messages.approvedReplacementLabel}: {entry.replacementDisplayName}
                      </p>
                    ) : null}
                  </td>
                  <td>
                    {entry.status === "open" ? (
                      <div className={styles.actionsCell}>
                        {reviewingRequestId === entry.id ? (
                          <div className={styles.reviewForm}>
                            {eligibleState?.status === "loading" ? (
                              <p className={styles.hint}>{messages.eligibleLoading}</p>
                            ) : null}
                            {eligibleState?.status === "error" ? (
                              <p className={styles.hint}>{messages.eligibleLoadError}</p>
                            ) : null}
                            {eligibleState?.status === "ready" && eligibleState.eligibleUsers.length === 0 ? (
                              <p className={styles.hint}>{messages.noEligibleReplacements}</p>
                            ) : null}
                            {eligibleState?.status === "ready" && eligibleState.eligibleUsers.length > 0 ? (
                              <select
                                value={selectedReplacementId}
                                onChange={(event) => setSelectedReplacementId(event.target.value)}
                              >
                                <option value="">{messages.selectReplacementPlaceholder}</option>
                                {eligibleState.eligibleUsers.map((user) => (
                                  <option key={user.userId} value={user.userId}>
                                    {user.displayName}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                            <div className={styles.reviewFormActions}>
                              <button
                                type="button"
                                className={styles.primaryButton}
                                disabled={!selectedReplacementId || actingRequestId === entry.id}
                                onClick={() => void handleApprove(entry.id)}
                              >
                                {actingRequestId === entry.id ? messages.approving : messages.confirmApprove}
                              </button>
                              <button
                                type="button"
                                className={styles.retryButton}
                                onClick={closeReview}
                                disabled={actingRequestId === entry.id}
                              >
                                {messages.cancelReview}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className={styles.reviewFormActions}>
                            <button
                              type="button"
                              className={styles.primaryButton}
                              onClick={() => void openReview(entry.id)}
                            >
                              {messages.reviewButton}
                            </button>
                            <button
                              type="button"
                              className={styles.dangerButton}
                              disabled={actingRequestId === entry.id}
                              onClick={() => void handleDecline(entry.id)}
                            >
                              {actingRequestId === entry.id ? messages.declining : messages.declineButton}
                            </button>
                          </div>
                        )}
                        {actionErrorByRequest[entry.id] ? (
                          <p className={styles.hint}>{actionErrorByRequest[entry.id]}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  );
}
