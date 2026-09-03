"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import styles from "./dashboard.module.css";
import { formatServiceDateTime, sortAssignmentsChronologically } from "./date-utils";
import { getDashboardMessages } from "./messages";
import { groupTeammatesByRole } from "./teammates-utils";
import type { Assignment } from "./types";

type AssignmentsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; assignments: readonly Assignment[] };

export function AssignmentsSection({
  idToken,
  locale,
}: Readonly<{ idToken: string; locale: Locale }>) {
  const messages = getDashboardMessages(locale);
  const [state, setState] = useState<AssignmentsState>({ status: "loading" });
  const [reloadToken, setReloadToken] = useState(0);

  const [requestFormOpenFor, setRequestFormOpenFor] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [submittingRequestFor, setSubmittingRequestFor] = useState<string | null>(null);
  const [cancellingRequestFor, setCancellingRequestFor] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ assignments: Assignment[] }>("/me/assignments", idToken)
      .then((response) => {
        if (cancelled) return;
        setState({
          status: "ready",
          assignments: sortAssignmentsChronologically(response.assignments),
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof ApiRequestError ? error.payload.message : messages.assignmentsErrorTitle;
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, [idToken, reloadToken, messages.assignmentsErrorTitle]);

  function updateAssignment(assignmentId: string, patch: Partial<Assignment>) {
    setState((previous) =>
      previous.status === "ready"
        ? {
            status: "ready",
            assignments: previous.assignments.map((entry) =>
              entry.assignmentId === assignmentId ? { ...entry, ...patch } : entry,
            ),
          }
        : previous,
    );
  }

  async function handleSubmitRequest(assignment: Assignment) {
    setActionError(null);
    setSubmittingRequestFor(assignment.assignmentId);
    try {
      const { replacementRequest } = await apiFetch<{ replacementRequest: { id: string } }>(
        "/replacement-requests",
        idToken,
        {
          method: "POST",
          body: JSON.stringify({
            assignmentId: assignment.assignmentId,
            reason: reasonText.trim() || null,
          }),
        },
      );
      updateAssignment(assignment.assignmentId, { openReplacementRequestId: replacementRequest.id });
      setRequestFormOpenFor(null);
      setReasonText("");
    } catch {
      setActionError(messages.requestCoverageError);
    } finally {
      setSubmittingRequestFor(null);
    }
  }

  async function handleCancelRequest(assignment: Assignment) {
    if (!assignment.openReplacementRequestId) return;
    const requestId = assignment.openReplacementRequestId;
    setActionError(null);
    setCancellingRequestFor(requestId);
    try {
      await apiFetch(`/replacement-requests/${requestId}/cancel`, idToken, { method: "POST" });
      updateAssignment(assignment.assignmentId, { openReplacementRequestId: null });
    } catch {
      setActionError(messages.cancelCoverageRequestError);
    } finally {
      setCancellingRequestFor(null);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="assignments-heading">
      <h2 id="assignments-heading">{messages.assignmentsTitle}</h2>

      {state.status === "loading" ? (
        <p className={styles.statusMessage}>{messages.assignmentsLoading}</p>
      ) : null}

      {state.status === "error" ? (
        <div className={styles.errorBox} role="alert">
          <span>{state.message || messages.assignmentsErrorTitle}</span>
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => {
              setState({ status: "loading" });
              setReloadToken((token) => token + 1);
            }}
          >
            {messages.assignmentsRetry}
          </button>
        </div>
      ) : null}

      {actionError ? (
        <div className={styles.errorBox} role="alert">
          <span>{actionError}</span>
        </div>
      ) : null}

      {state.status === "ready" && state.assignments.length === 0 ? (
        <div className={styles.emptyState}>
          <strong>{messages.assignmentsEmptyTitle}</strong>
          <p>{messages.assignmentsEmptyDescription}</p>
        </div>
      ) : null}

      {state.status === "ready" && state.assignments.length > 0 ? (
        <ul className={styles.assignmentList}>
          {state.assignments.map((assignment) => {
            const teammateGroups = groupTeammatesByRole(assignment.teammates);
            return (
              <li key={assignment.assignmentId} className={styles.assignmentCard}>
                <span className={styles.assignmentWhen}>
                  {formatServiceDateTime(assignment.serviceDate, assignment.serviceTime, locale)}
                </span>
                <span className={styles.assignmentTitle}>{assignment.title}</span>
                <span className={styles.assignmentRole} aria-label={messages.assignmentsRoleLabel}>
                  {assignment.role}
                </span>
                {teammateGroups.length > 0 ? (
                  <span className={styles.assignmentTeammates}>
                    <strong>{messages.assignmentsTeammatesTitle}: </strong>
                    {teammateGroups
                      .map((group) => `${group.role} — ${group.names.join(", ")}`)
                      .join(" · ")}
                  </span>
                ) : null}

                {assignment.openReplacementRequestId ? (
                  <div className={styles.coverageRequestRow}>
                    <span className={styles.coverageRequestedLabel}>{messages.coverageRequestedLabel}</span>
                    <button
                      type="button"
                      className={styles.retryButton}
                      disabled={cancellingRequestFor === assignment.openReplacementRequestId}
                      onClick={() => void handleCancelRequest(assignment)}
                    >
                      {cancellingRequestFor === assignment.openReplacementRequestId
                        ? messages.cancellingCoverageRequest
                        : messages.cancelCoverageRequestButton}
                    </button>
                  </div>
                ) : requestFormOpenFor === assignment.assignmentId ? (
                  <form
                    className={styles.coverageRequestForm}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleSubmitRequest(assignment);
                    }}
                  >
                    <label htmlFor={`reason-${assignment.assignmentId}`}>
                      {messages.requestCoverageReasonLabel}
                    </label>
                    <textarea
                      id={`reason-${assignment.assignmentId}`}
                      value={reasonText}
                      onChange={(event) => setReasonText(event.target.value)}
                      maxLength={500}
                      rows={2}
                    />
                    <div className={styles.coverageRequestActions}>
                      <button
                        type="submit"
                        className={styles.retryButton}
                        disabled={submittingRequestFor === assignment.assignmentId}
                      >
                        {submittingRequestFor === assignment.assignmentId
                          ? messages.requestCoverageSubmitting
                          : messages.requestCoverageSubmit}
                      </button>
                      <button
                        type="button"
                        className={styles.retryButton}
                        onClick={() => {
                          setRequestFormOpenFor(null);
                          setReasonText("");
                        }}
                      >
                        {messages.requestCoverageCancel}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className={styles.coverageRequestRow}>
                    <button
                      type="button"
                      className={styles.retryButton}
                      onClick={() => {
                        setRequestFormOpenFor(assignment.assignmentId);
                        setReasonText("");
                      }}
                    >
                      {messages.requestCoverageButton}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
