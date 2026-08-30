"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { isLocale, type Locale } from "@/i18n/config";
import { ApiRequestError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-client";
import {
  getCandidateDetail,
  getEligibleAssignees,
  listRoles,
  listServices,
  publishCandidate,
  reassignAssignment,
  regenerateCandidate,
  setAssignmentLock,
} from "../../../../api";
import { ConfirmDialog } from "../../../../confirm-dialog";
import { resolveApiErrorMessage } from "../../../../errors";
import { formatDateTime } from "../../../../format";
import { formatMessage, getAdminMessages, type AdminMessages } from "../../../../messages";
import { StatusBadge } from "../../../../status-badge";
import styles from "../../../../admin.module.css";
import type {
  AssignmentDetail,
  CandidateDetail,
  EligibleAssignee,
  InfeasibleLock,
  InfeasibleLockReason,
  Role,
  Service,
} from "../../../../types";

type LoadState = "loading" | "ready" | "error";

function reasonSentence(reason: InfeasibleLockReason, messages: AdminMessages): string {
  switch (reason) {
    case "unqualified":
      return messages.reasonUnqualified;
    case "inactive":
      return messages.reasonInactive;
    case "unavailable":
      return messages.reasonUnavailable;
    case "requirement_exceeded":
      return messages.reasonRequirementExceeded;
    case "service_not_found":
    default:
      return messages.reasonServiceNotFound;
  }
}

export default function CandidateDetailPage() {
  const params = useParams<{ locale: string; periodId: string; candidateId: string }>();
  const locale: Locale = isLocale(params.locale) ? params.locale : "en";
  const { periodId, candidateId } = params;
  const messages = getAdminMessages(locale);
  const { idToken } = useAuth();
  const router = useRouter();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [detail, setDetail] = useState<CandidateDetail | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const load = useCallback(async () => {
    if (!idToken) return;
    try {
      const [candidateDetail, servicesResponse, rolesResponse] = await Promise.all([
        getCandidateDetail(idToken, periodId, candidateId),
        listServices(idToken, periodId),
        listRoles(idToken),
      ]);
      setDetail(candidateDetail);
      setServices([...servicesResponse.services]);
      setRoles([...rolesResponse.roles]);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [idToken, periodId, candidateId]);

  useEffect(() => {
    // Client-side fetch gated on the Firebase ID token becoming available;
    // there is no server-rendered alternative for an administrator-only,
    // token-authenticated read, and this project intentionally avoids
    // adding a client data-fetching library.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function retryLoad() {
    setLoadState("loading");
    void load();
  }

  const serviceTitleById = useMemo(() => new Map(services.map((service) => [service.id, service.title])), [
    services,
  ]);
  const roleNameById = useMemo(() => new Map(roles.map((role) => [role.id, role.name])), [roles]);
  const userNameById = useMemo(
    () => new Map((detail?.assignments ?? []).map((assignment) => [assignment.userId, assignment.userDisplayName])),
    [detail],
  );

  const [lockUpdatingId, setLockUpdatingId] = useState<string | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);

  async function handleToggleLock(assignmentId: string, nextLocked: boolean) {
    if (!idToken || !detail) return;
    setLockError(null);
    setLockUpdatingId(assignmentId);
    try {
      await setAssignmentLock(idToken, periodId, candidateId, assignmentId, nextLocked);
      setDetail((previous) =>
        previous
          ? {
              ...previous,
              assignments: previous.assignments.map((assignment) =>
                assignment.id === assignmentId ? { ...assignment, isLocked: nextLocked } : assignment,
              ),
            }
          : previous,
      );
    } catch (error) {
      setLockError(resolveApiErrorMessage(error, messages));
    } finally {
      setLockUpdatingId(null);
    }
  }

  const [reassignTarget, setReassignTarget] = useState<AssignmentDetail | null>(null);
  const [eligibleUsers, setEligibleUsers] = useState<EligibleAssignee[]>([]);
  const [eligibleLoadState, setEligibleLoadState] = useState<LoadState>("loading");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassignSuccess, setReassignSuccess] = useState(false);
  const [reassigning, setReassigning] = useState(false);

  async function openReassignDialog(assignment: AssignmentDetail) {
    setReassignTarget(assignment);
    setReassignError(null);
    setReassignSuccess(false);
    setSelectedUserId("");
    setEligibleLoadState("loading");
    if (!idToken) return;
    try {
      const { eligibleUsers: fetched } = await getEligibleAssignees(
        idToken,
        periodId,
        candidateId,
        assignment.id,
      );
      setEligibleUsers([...fetched]);
      setEligibleLoadState("ready");
    } catch {
      setEligibleLoadState("error");
    }
  }

  function closeReassignDialog() {
    setReassignTarget(null);
  }

  async function handleReassignSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!idToken || !reassignTarget || !selectedUserId) return;
    setReassignError(null);
    setReassigning(true);
    try {
      const result = await reassignAssignment(
        idToken,
        periodId,
        candidateId,
        reassignTarget.id,
        selectedUserId,
      );
      const newDisplayName =
        eligibleUsers.find((user) => user.userId === selectedUserId)?.displayName ?? "";
      setDetail((previous) =>
        previous
          ? {
              ...previous,
              assignments: previous.assignments.map((assignment) =>
                assignment.id === reassignTarget.id
                  ? {
                      ...assignment,
                      userId: result.userId,
                      userDisplayName: newDisplayName,
                      isLocked: result.isLocked,
                      source: result.source,
                    }
                  : assignment,
              ),
            }
          : previous,
      );
      setReassignSuccess(true);
    } catch (error) {
      setReassignError(resolveApiErrorMessage(error, messages));
    } finally {
      setReassigning(false);
    }
  }

  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [infeasibleLocks, setInfeasibleLocks] = useState<InfeasibleLock[] | null>(null);

  async function handleRegenerate() {
    if (!idToken) return;
    setRegenerateError(null);
    setInfeasibleLocks(null);
    setRegenerating(true);
    try {
      const result = await regenerateCandidate(idToken, periodId, candidateId);
      router.push(`/${locale}/admin/periods/${periodId}/candidates/${result.candidate.id}`);
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.payload.code === "infeasible_lock" &&
        error.payload.details &&
        typeof error.payload.details === "object"
      ) {
        const details = error.payload.details as { infeasibleLocks?: InfeasibleLock[] };
        if (Array.isArray(details.infeasibleLocks)) {
          setInfeasibleLocks(details.infeasibleLocks);
        }
      }
      setRegenerateError(resolveApiErrorMessage(error, messages));
    } finally {
      setRegenerating(false);
    }
  }

  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState(false);

  async function handlePublish() {
    if (!idToken) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const { candidate } = await publishCandidate(idToken, periodId, candidateId);
      setDetail((previous) =>
        previous ? { ...previous, candidate: { ...previous.candidate, status: candidate.status } } : previous,
      );
      setPublishSuccess(true);
      setPublishDialogOpen(false);
    } catch (error) {
      setPublishError(resolveApiErrorMessage(error, messages));
      setPublishDialogOpen(false);
    } finally {
      setPublishing(false);
    }
  }

  if (loadState === "loading") {
    return (
      <div className={styles.page}>
        <p role="status">{messages.loading}</p>
      </div>
    );
  }

  if (loadState === "error" || !detail) {
    return (
      <div className={styles.page}>
        <Link className={styles.breadcrumb} href={`/${locale}/admin/periods/${periodId}`}>
          {messages.backToPeriod}
        </Link>
        <div className={styles.errorBanner} role="alert">
          <p>{messages.candidateLoadError}</p>
          <button type="button" className={styles.secondaryButton} onClick={retryLoad}>
            {messages.retry}
          </button>
        </div>
      </div>
    );
  }

  const { candidate, assignments } = detail;
  const isDraft = candidate.status === "draft";
  const explanation = candidate.explanation;
  const assignmentCountEntries = Object.entries(explanation.fairness.assignmentCountsByUser);

  const assignmentGroups: Array<{
    serviceId: string;
    serviceTitle: string;
    serviceStartsAt: string;
    assignments: AssignmentDetail[];
  }> = [];
  for (const assignment of assignments) {
    const group = assignmentGroups.find((entry) => entry.serviceId === assignment.serviceId);
    if (group) {
      group.assignments.push(assignment);
    } else {
      assignmentGroups.push({
        serviceId: assignment.serviceId,
        serviceTitle: assignment.serviceTitle,
        serviceStartsAt: assignment.serviceStartsAt,
        assignments: [assignment],
      });
    }
  }

  return (
    <div className={styles.page}>
      <Link className={styles.breadcrumb} href={`/${locale}/admin/periods/${periodId}`}>
        {messages.backToPeriod}
      </Link>

      <section className={styles.panel}>
        <div className={styles.actionsRow}>
          <h1 className={styles.panelHeading}>
            {formatMessage(messages.candidateHeading, { version: candidate.version })}
          </h1>
          <StatusBadge status={candidate.status} messages={messages} />
        </div>
        <div className={styles.summaryRow}>
          <span>
            {messages.objectiveScoreLabel}: {candidate.objectiveScore ?? "–"}
          </span>
          <span className={explanation.infeasible ? styles.constraintsBad : styles.constraintsOk}>
            {messages.hardConstraintsLabel}:{" "}
            {candidate.hardConstraintsSatisfied ? messages.constraintsSatisfied : messages.constraintsUnsatisfied}
          </span>
        </div>

        <div>
          <h3 className={styles.panelHeading}>{messages.coverageHeading}</h3>
          <div className={styles.statGrid}>
            <div className={styles.statTile}>
              <strong>{explanation.coverage.totalRequired}</strong>
              <span>{messages.totalRequiredLabel}</span>
            </div>
            <div className={styles.statTile}>
              <strong>{explanation.coverage.totalAssigned}</strong>
              <span>{messages.totalAssignedLabel}</span>
            </div>
            <div className={styles.statTile}>
              <strong>{explanation.coverage.unfilledCount}</strong>
              <span>{messages.unfilledCountLabel}</span>
            </div>
            <div className={styles.statTile}>
              <strong>{explanation.coverage.coveragePercentage}%</strong>
              <span>{messages.coveragePercentageLabel}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className={styles.panelHeading}>{messages.fairnessHeading}</h3>
          <div className={styles.statGrid}>
            <div className={styles.statTile}>
              <strong>{explanation.fairness.minAssignments}</strong>
              <span>{messages.minAssignmentsLabel}</span>
            </div>
            <div className={styles.statTile}>
              <strong>{explanation.fairness.maxAssignments}</strong>
              <span>{messages.maxAssignmentsLabel}</span>
            </div>
            <div className={styles.statTile}>
              <strong>{explanation.fairness.meanAssignments}</strong>
              <span>{messages.meanAssignmentsLabel}</span>
            </div>
            <div className={styles.statTile}>
              <strong>{explanation.fairness.spread}</strong>
              <span>{messages.spreadLabel}</span>
            </div>
          </div>
          {assignmentCountEntries.length > 0 ? (
            <div>
              <h4 className={styles.panelHeading}>{messages.assignmentCountsHeading}</h4>
              <ul>
                {assignmentCountEntries.map(([userId, count]) => (
                  <li key={userId}>
                    {userNameById.get(userId) ?? userId}: {count}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className={styles.summaryRow}>
          <span>
            {messages.primaryAssignmentsLabel}: {explanation.primaryAssignments}
          </span>
          <span>
            {messages.preferredAssignmentsLabel}: {explanation.preferredAssignments}
          </span>
        </div>

        <div>
          <h3 className={styles.panelHeading}>{messages.unfilledRolesHeading}</h3>
          {explanation.unfilledRoles.length === 0 ? (
            <p className={styles.emptyState}>{messages.unfilledRolesEmpty}</p>
          ) : (
            <ul className={styles.infeasibleList}>
              {explanation.unfilledRoles.map((unfilled) => (
                <li key={`${unfilled.serviceId}-${unfilled.roleId}`}>
                  {serviceTitleById.get(unfilled.serviceId) ?? unfilled.serviceId} —{" "}
                  {roleNameById.get(unfilled.roleId) ?? unfilled.roleId}: {unfilled.assignedCount}/
                  {unfilled.requiredCount} ({unfilled.missingCount} {messages.missingCountLabel})
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelHeading}>{messages.assignmentsHeading}</h2>
        {lockError ? (
          <div className={styles.errorBanner} role="alert">
            <p>{lockError}</p>
          </div>
        ) : null}
        {assignments.length === 0 ? (
          <p className={styles.emptyState}>{messages.assignmentsEmpty}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{messages.assignmentColumnRole}</th>
                <th>{messages.assignmentColumnVolunteer}</th>
                <th>{messages.assignmentColumnStatus}</th>
                {isDraft ? <th>{messages.assignmentColumnActions}</th> : null}
              </tr>
            </thead>
            <tbody>
              {assignmentGroups.map((group) => (
                <Fragment key={group.serviceId}>
                  <tr>
                    <td colSpan={isDraft ? 4 : 3} className={styles.serviceGroupHeader}>
                      {group.serviceTitle} · {formatDateTime(group.serviceStartsAt, locale)}
                    </td>
                  </tr>
                  {group.assignments.map((assignment) => (
                    <tr key={assignment.id} className={assignment.isLocked ? styles.rowCarriedOver : undefined}>
                      <td>{assignment.roleName}</td>
                      <td>{assignment.userDisplayName}</td>
                      <td>
                        {assignment.isLocked ? (
                          <span className={styles.lockBadge}>{messages.carriedOverLabel}</span>
                        ) : (
                          <span className={styles.newBadge}>{messages.newlySolvedLabel}</span>
                        )}
                      </td>
                      {isDraft ? (
                        <td>
                          <div className={styles.actionsRow}>
                            <button
                              type="button"
                              className={styles.smallButton}
                              disabled={lockUpdatingId === assignment.id}
                              onClick={() => void handleToggleLock(assignment.id, !assignment.isLocked)}
                            >
                              {lockUpdatingId === assignment.id
                                ? messages.updatingLock
                                : assignment.isLocked
                                  ? messages.unlockButton
                                  : messages.lockButton}
                            </button>
                            <button
                              type="button"
                              className={styles.smallButton}
                              onClick={() => void openReassignDialog(assignment)}
                            >
                              {messages.reassignButton}
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {isDraft ? (
        <section className={styles.panel}>
          <h2 className={styles.panelHeading}>{messages.regenerateHeading}</h2>
          <p className={styles.panelIntro}>{messages.regenerateIntro}</p>

          {infeasibleLocks && infeasibleLocks.length > 0 ? (
            <div className={styles.errorBanner} role="alert">
              <p>
                <strong>{messages.infeasibleLockHeading}</strong>
              </p>
              <p>{messages.infeasibleLockIntro}</p>
              <ul className={styles.infeasibleList}>
                {infeasibleLocks.map((lock, index) => (
                  <li key={`${lock.serviceId}-${lock.roleId}-${lock.userId}-${index}`}>
                    {userNameById.get(lock.userId) ?? lock.userId} —{" "}
                    {serviceTitleById.get(lock.serviceId) ?? lock.serviceId} (
                    {roleNameById.get(lock.roleId) ?? lock.roleId}): {reasonSentence(lock.reason, messages)}
                  </li>
                ))}
              </ul>
            </div>
          ) : regenerateError ? (
            <div className={styles.errorBanner} role="alert">
              <p>{regenerateError}</p>
            </div>
          ) : null}

          <div className={styles.actionsRow}>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={regenerating}
              onClick={() => void handleRegenerate()}
            >
              {regenerating ? messages.regenerating : messages.regenerateSubmit}
            </button>
          </div>
        </section>
      ) : null}

      {isDraft ? (
        <section className={styles.panel}>
          <h2 className={styles.panelHeading}>{messages.publishHeading}</h2>
          <p className={styles.panelIntro}>{messages.publishIntro}</p>
          {!candidate.hardConstraintsSatisfied ? (
            <div className={styles.errorBanner} role="alert">
              <p>{messages.publishBlockedInfeasible}</p>
            </div>
          ) : null}
          {publishError ? (
            <div className={styles.errorBanner} role="alert">
              <p>{publishError}</p>
            </div>
          ) : null}
          {publishSuccess ? (
            <div className={styles.successBanner} role="status">
              <p>{messages.publishSuccess}</p>
            </div>
          ) : null}
          <div className={styles.actionsRow}>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={publishing || publishSuccess}
              onClick={() => setPublishDialogOpen(true)}
            >
              {publishing ? messages.publishing : messages.publishButton}
            </button>
          </div>
        </section>
      ) : null}

      {reassignTarget ? (
        <div className={styles.dialogOverlay} role="presentation" onClick={closeReassignDialog}>
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reassign-heading"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="reassign-heading" className={styles.panelHeading}>
              {messages.reassignHeading}
            </h2>
            <p className={styles.panelIntro}>{messages.reassignIntro}</p>

            {eligibleLoadState === "loading" ? <p role="status">{messages.loading}</p> : null}

            {eligibleLoadState === "error" ? (
              <div className={styles.errorBanner} role="alert">
                <p>{messages.reassignLoadError}</p>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => void openReassignDialog(reassignTarget)}
                >
                  {messages.retry}
                </button>
              </div>
            ) : null}

            {eligibleLoadState === "ready" && eligibleUsers.length === 0 ? (
              <p className={styles.emptyState}>{messages.reassignNoEligible}</p>
            ) : null}

            {eligibleLoadState === "ready" && eligibleUsers.length > 0 ? (
              <form className={styles.form} onSubmit={(event) => void handleReassignSubmit(event)}>
                <div className={styles.field}>
                  <label htmlFor="reassign-user">{messages.reassignSelectLabel}</label>
                  <select
                    id="reassign-user"
                    value={selectedUserId}
                    onChange={(event) => setSelectedUserId(event.target.value)}
                  >
                    <option value="">{messages.reassignSelectPlaceholder}</option>
                    {eligibleUsers.map((user) => (
                      <option key={user.userId} value={user.userId}>
                        {user.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                {reassignError ? (
                  <div className={styles.errorBanner} role="alert">
                    <p>{reassignError}</p>
                  </div>
                ) : null}

                {reassignSuccess ? (
                  <div className={styles.successBanner}>
                    <p>{messages.reassignSuccess}</p>
                  </div>
                ) : null}

                <div className={styles.actionsRow}>
                  <button
                    type="submit"
                    className={styles.primaryButton}
                    disabled={reassigning || !selectedUserId}
                  >
                    {reassigning ? messages.reassigning : messages.reassignSubmit}
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={closeReassignDialog}
                    disabled={reassigning}
                  >
                    {messages.closeReassignDialog}
                  </button>
                </div>
              </form>
            ) : (
              <div className={styles.actionsRow}>
                <button type="button" className={styles.secondaryButton} onClick={closeReassignDialog}>
                  {messages.closeReassignDialog}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {publishDialogOpen ? (
        <ConfirmDialog
          title={messages.publishConfirmTitle}
          body={messages.publishConfirmBody}
          confirmLabel={messages.publishConfirmConfirm}
          cancelLabel={messages.publishConfirmCancel}
          busy={publishing}
          onConfirm={() => void handlePublish()}
          onCancel={() => setPublishDialogOpen(false)}
        />
      ) : null}
    </div>
  );
}
