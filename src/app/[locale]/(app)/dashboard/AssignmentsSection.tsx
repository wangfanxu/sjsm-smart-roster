"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import styles from "./dashboard.module.css";
import { formatServiceDateTime, sortAssignmentsChronologically } from "./date-utils";
import { getDashboardMessages } from "./messages";
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

      {state.status === "ready" && state.assignments.length === 0 ? (
        <div className={styles.emptyState}>
          <strong>{messages.assignmentsEmptyTitle}</strong>
          <p>{messages.assignmentsEmptyDescription}</p>
        </div>
      ) : null}

      {state.status === "ready" && state.assignments.length > 0 ? (
        <ul className={styles.assignmentList}>
          {state.assignments.map((assignment) => (
            <li key={assignment.assignmentId} className={styles.assignmentCard}>
              <span className={styles.assignmentWhen}>
                {formatServiceDateTime(assignment.serviceDate, assignment.serviceTime, locale)}
              </span>
              <span className={styles.assignmentTitle}>{assignment.title}</span>
              <span className={styles.assignmentRole} aria-label={messages.assignmentsRoleLabel}>
                {assignment.role}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
