"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { isLocale, type Locale } from "@/i18n/config";
import { useAuth } from "@/lib/auth-client";
import {
  createService,
  deleteService,
  generateCandidate,
  listCandidates,
  listPlanningPeriods,
  listRoles,
  listServices,
  updateService,
} from "../../api";
import { ConfirmDialog } from "../../confirm-dialog";
import { extractValidationFieldPaths, resolveApiErrorMessage } from "../../errors";
import { formatDate, formatDateTime, splitSingaporeIsoString, toSingaporeIsoString } from "../../format";
import { formatMessage, getAdminMessages } from "../../messages";
import {
  emptyRequirementRow,
  nextRequirementRowKey,
  requirementsFieldError,
  requirementsPayload,
  RoleRequirementsEditor,
  type RequirementRow,
} from "../../role-requirements-editor";
import { StatusBadge } from "../../status-badge";
import styles from "../../admin.module.css";
import type { CandidateSummary, PlanningPeriod, Role, Service } from "../../types";

type LoadState = "loading" | "ready" | "error";

export default function PlanningPeriodDetailPage() {
  const params = useParams<{ locale: string; periodId: string }>();
  const locale: Locale = isLocale(params.locale) ? params.locale : "en";
  const periodId = params.periodId;
  const messages = getAdminMessages(locale);
  const { idToken } = useAuth();
  const router = useRouter();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [period, setPeriod] = useState<PlanningPeriod | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [candidates, setCandidates] = useState<CandidateSummary[]>([]);

  const loadAll = useCallback(async () => {
    if (!idToken) return;
    try {
      const [periodsResponse, servicesResponse, rolesResponse, candidatesResponse] = await Promise.all([
        listPlanningPeriods(idToken),
        listServices(idToken, periodId),
        listRoles(idToken),
        listCandidates(idToken, periodId),
      ]);
      setPeriod(periodsResponse.planningPeriods.find((entry) => entry.id === periodId) ?? null);
      setServices([...servicesResponse.services]);
      setRoles([...rolesResponse.roles]);
      setCandidates([...candidatesResponse.candidates]);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [idToken, periodId]);

  useEffect(() => {
    // Client-side fetch gated on the Firebase ID token becoming available;
    // there is no server-rendered alternative for an administrator-only,
    // token-authenticated read, and this project intentionally avoids
    // adding a client data-fetching library.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAll();
  }, [loadAll]);

  function retryLoadAll() {
    setLoadState("loading");
    void loadAll();
  }

  // --- Create service form ---
  const [title, setTitle] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [serviceTime, setServiceTime] = useState("");
  const [notes, setNotes] = useState("");
  const [requirementRows, setRequirementRows] = useState<RequirementRow[]>([emptyRequirementRow()]);
  const [serviceFieldErrors, setServiceFieldErrors] = useState<Record<string, string>>({});
  const [serviceFormError, setServiceFormError] = useState<string | null>(null);
  const [serviceSuccess, setServiceSuccess] = useState(false);
  const [creatingService, setCreatingService] = useState(false);

  function validateServiceForm(): Record<string, string> {
    const errors: Record<string, string> = {};
    const trimmedTitle = title.trim();
    if (!trimmedTitle || trimmedTitle.length > 160) {
      errors.title = messages.titleRequired;
    }
    if (!serviceDate || !serviceTime) {
      errors.startsAt = messages.serviceDateTimeRequired;
    }
    const requirementsError = requirementsFieldError(requirementRows, messages);
    if (requirementsError) errors.requirements = requirementsError;
    return errors;
  }

  async function handleCreateService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!idToken) return;
    setServiceFormError(null);
    setServiceSuccess(false);
    const errors = validateServiceForm();
    setServiceFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const startsAt = toSingaporeIsoString(serviceDate, serviceTime);
    if (!startsAt) {
      setServiceFieldErrors({ startsAt: messages.serviceDateTimeRequired });
      return;
    }

    setCreatingService(true);
    try {
      const { service } = await createService(idToken, periodId, {
        title: title.trim(),
        startsAt,
        notes: notes.trim() ? notes.trim() : null,
        requirements: requirementsPayload(requirementRows),
      });
      setServices((previous) =>
        [...previous, service].sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
      );
      setTitle("");
      setServiceDate("");
      setServiceTime("");
      setNotes("");
      setRequirementRows([emptyRequirementRow()]);
      setServiceSuccess(true);
    } catch (error) {
      const paths = extractValidationFieldPaths(error);
      if (paths.some((path) => path.startsWith("requirements"))) {
        setServiceFieldErrors({ requirements: messages.requirementsRequired });
      } else if (paths.includes("title")) {
        setServiceFieldErrors({ title: messages.titleRequired });
      } else if (paths.includes("startsAt")) {
        setServiceFieldErrors({ startsAt: messages.serviceDateTimeRequired });
      } else {
        setServiceFormError(resolveApiErrorMessage(error, messages));
      }
    } finally {
      setCreatingService(false);
    }
  }

  // --- Edit / delete service ---
  const [serviceActionError, setServiceActionError] = useState<string | null>(null);
  const [editServiceTarget, setEditServiceTarget] = useState<Service | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editServiceDate, setEditServiceDate] = useState("");
  const [editServiceTime, setEditServiceTime] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editRequirementRows, setEditRequirementRows] = useState<RequirementRow[]>([emptyRequirementRow()]);
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [savingServiceEdit, setSavingServiceEdit] = useState(false);

  const [deleteServiceTarget, setDeleteServiceTarget] = useState<Service | null>(null);
  const [deletingService, setDeletingService] = useState(false);

  function openEditServiceDialog(service: Service) {
    setServiceActionError(null);
    setEditServiceTarget(service);
    setEditTitle(service.title);
    const { date, time } = splitSingaporeIsoString(service.startsAt);
    setEditServiceDate(date);
    setEditServiceTime(time);
    setEditNotes(service.notes ?? "");
    setEditRequirementRows(
      service.requirements.length > 0
        ? service.requirements.map((requirement) => ({
            key: nextRequirementRowKey(),
            roleId: requirement.roleId,
            requiredCount: String(requirement.requiredCount),
          }))
        : [emptyRequirementRow()],
    );
    setEditFieldErrors({});
    setEditFormError(null);
  }

  function closeEditServiceDialog() {
    setEditServiceTarget(null);
  }

  async function handleEditServiceSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!idToken || !editServiceTarget) return;
    setEditFormError(null);

    const errors: Record<string, string> = {};
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle || trimmedTitle.length > 160) errors.title = messages.titleRequired;
    if (!editServiceDate || !editServiceTime) errors.startsAt = messages.serviceDateTimeRequired;
    const requirementsError = requirementsFieldError(editRequirementRows, messages);
    if (requirementsError) errors.requirements = requirementsError;
    setEditFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const startsAt = toSingaporeIsoString(editServiceDate, editServiceTime);
    if (!startsAt) {
      setEditFieldErrors({ startsAt: messages.serviceDateTimeRequired });
      return;
    }

    setSavingServiceEdit(true);
    try {
      const { service } = await updateService(idToken, periodId, editServiceTarget.id, {
        title: trimmedTitle,
        startsAt,
        notes: editNotes.trim() ? editNotes.trim() : null,
        requirements: requirementsPayload(editRequirementRows),
      });
      setServices((previous) =>
        previous
          .map((existing) => (existing.id === service.id ? service : existing))
          .sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
      );
      setEditServiceTarget(null);
    } catch (error) {
      setEditFormError(resolveApiErrorMessage(error, messages));
    } finally {
      setSavingServiceEdit(false);
    }
  }

  async function handleDeleteService() {
    if (!idToken || !deleteServiceTarget) return;
    setServiceActionError(null);
    setDeletingService(true);
    try {
      await deleteService(idToken, periodId, deleteServiceTarget.id);
      setServices((previous) => previous.filter((service) => service.id !== deleteServiceTarget.id));
      setDeleteServiceTarget(null);
    } catch (error) {
      setServiceActionError(resolveApiErrorMessage(error, messages));
      setDeleteServiceTarget(null);
    } finally {
      setDeletingService(false);
    }
  }

  // --- Generate candidate form ---
  const [weightPrimaryRole, setWeightPrimaryRole] = useState("");
  const [weightPreferredAvailability, setWeightPreferredAvailability] = useState("");
  const [weightLoadBalance, setWeightLoadBalance] = useState("");
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  function parseWeight(value: string): number | undefined {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : Number.NaN;
  }

  async function handleGenerateCandidate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!idToken) return;
    setGenerateError(null);

    const primaryRole = parseWeight(weightPrimaryRole);
    const preferredAvailability = parseWeight(weightPreferredAvailability);
    const loadBalance = parseWeight(weightLoadBalance);
    const allWeights = [primaryRole, preferredAvailability, loadBalance];
    if (allWeights.some((value) => value !== undefined && (Number.isNaN(value) || value < 0 || value > 100))) {
      setGenerateError(messages.weightRange);
      return;
    }

    setGenerating(true);
    try {
      const weights =
        primaryRole !== undefined || preferredAvailability !== undefined || loadBalance !== undefined
          ? { primaryRole, preferredAvailability, loadBalance }
          : undefined;
      const result = await generateCandidate(idToken, periodId, weights);
      router.push(`/${locale}/admin/periods/${periodId}/candidates/${result.candidate.id}`);
    } catch (error) {
      setGenerateError(resolveApiErrorMessage(error, messages));
    } finally {
      setGenerating(false);
    }
  }

  if (loadState === "loading") {
    return (
      <div className={styles.page}>
        <p role="status">{messages.loading}</p>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className={styles.page}>
        <div className={styles.errorBanner} role="alert">
          <p>{messages.periodsLoadError}</p>
          <button type="button" className={styles.secondaryButton} onClick={retryLoadAll}>
            {messages.retry}
          </button>
        </div>
      </div>
    );
  }

  if (!period) {
    return (
      <div className={styles.page}>
        <Link className={styles.breadcrumb} href={`/${locale}/admin/periods`}>
          {messages.backToPeriods}
        </Link>
        <div className={styles.errorBanner} role="alert">
          <p>{messages.periodNotFound}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link className={styles.breadcrumb} href={`/${locale}/admin/periods`}>
        {messages.backToPeriods}
      </Link>

      <section className={styles.panel}>
        <h1 className={styles.panelHeading}>{period.name}</h1>
        <p className={styles.summaryRow}>
          {formatMessage(messages.periodRange, {
            startsOn: formatDate(period.startsOn, locale),
            endsOn: formatDate(period.endsOn, locale),
          })}
        </p>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelHeading}>{messages.servicesHeading}</h2>
        {serviceActionError ? (
          <div className={styles.errorBanner} role="alert">
            <p>{serviceActionError}</p>
          </div>
        ) : null}
        {services.length === 0 ? (
          <p className={styles.emptyState}>{messages.servicesEmpty}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{messages.serviceColumnTitle}</th>
                <th>{messages.serviceColumnStart}</th>
                <th>{messages.serviceColumnNotes}</th>
                <th>{messages.serviceColumnRequirements}</th>
                <th>{messages.serviceColumnActions}</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id}>
                  <td>{service.title}</td>
                  <td>{formatDateTime(service.startsAt, locale)}</td>
                  <td>{service.notes ?? ""}</td>
                  <td>
                    <div className={styles.roleBadgeList}>
                      {service.requirements.map((requirement) => (
                        <span
                          key={requirement.roleId}
                          className={`${styles.badge} ${styles.badgeDraft}`}
                        >
                          {requirement.roleName} × {requirement.requiredCount}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className={styles.actionsRow}>
                      <button
                        type="button"
                        className={styles.smallButton}
                        onClick={() => openEditServiceDialog(service)}
                      >
                        {messages.editServiceButton}
                      </button>
                      <button
                        type="button"
                        className={styles.dangerButton}
                        onClick={() => setDeleteServiceTarget(service)}
                      >
                        {messages.deleteServiceButton}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h3 className={styles.panelHeading}>{messages.createServiceHeading}</h3>
        <form className={styles.form} onSubmit={(event) => void handleCreateService(event)}>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label htmlFor="service-title">{messages.fieldTitle}</label>
              <input
                id="service-title"
                type="text"
                maxLength={160}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              {serviceFieldErrors.title ? (
                <p className={styles.fieldError}>{serviceFieldErrors.title}</p>
              ) : null}
            </div>
            <div className={styles.field}>
              <label htmlFor="service-date">{messages.fieldServiceDate}</label>
              <input
                id="service-date"
                type="date"
                value={serviceDate}
                onChange={(event) => setServiceDate(event.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="service-time">{messages.fieldServiceTime}</label>
              <input
                id="service-time"
                type="time"
                value={serviceTime}
                onChange={(event) => setServiceTime(event.target.value)}
              />
              {serviceFieldErrors.startsAt ? (
                <p className={styles.fieldError}>{serviceFieldErrors.startsAt}</p>
              ) : null}
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="service-notes">{messages.fieldNotes}</label>
            <textarea
              id="service-notes"
              maxLength={2000}
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <RoleRequirementsEditor
            idPrefix="service"
            rows={requirementRows}
            roles={roles}
            onChange={setRequirementRows}
            error={serviceFieldErrors.requirements}
            heading={messages.requirementsHeading}
            hint={messages.requirementsHint}
            addLabel={messages.addRequirement}
            removeLabel={messages.removeRequirement}
            roleLabel={messages.fieldRole}
            countLabel={messages.fieldRequiredCount}
            selectPlaceholder={messages.selectRole}
          />

          {serviceFormError ? (
            <div className={styles.errorBanner} role="alert">
              <p>{serviceFormError}</p>
            </div>
          ) : null}
          {serviceSuccess ? (
            <div className={styles.successBanner} role="status">
              <p>{messages.serviceCreated}</p>
            </div>
          ) : null}

          <div className={styles.actionsRow}>
            <button type="submit" className={styles.primaryButton} disabled={creatingService}>
              {creatingService ? messages.creatingService : messages.createServiceSubmit}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelHeading}>{messages.candidatesHeading}</h2>
        {candidates.length === 0 ? (
          <p className={styles.emptyState}>{messages.candidatesEmpty}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{messages.candidateColumnVersion}</th>
                <th>{messages.candidateColumnStatus}</th>
                <th>{messages.candidateColumnScore}</th>
                <th>{messages.candidateColumnConstraints}</th>
                <th>{messages.candidateColumnGenerated}</th>
                <th>{messages.periodColumnActions}</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr key={candidate.id}>
                  <td>{candidate.version}</td>
                  <td>
                    <StatusBadge status={candidate.status} messages={messages} />
                  </td>
                  <td>{candidate.objectiveScore ?? "–"}</td>
                  <td>
                    <span
                      className={
                        candidate.hardConstraintsSatisfied ? styles.constraintsOk : styles.constraintsBad
                      }
                    >
                      {candidate.hardConstraintsSatisfied
                        ? messages.constraintsSatisfied
                        : messages.constraintsUnsatisfied}
                    </span>
                  </td>
                  <td>{candidate.generatedAt ? formatDateTime(candidate.generatedAt, locale) : "–"}</td>
                  <td>
                    <Link
                      className={styles.smallButton}
                      href={`/${locale}/admin/periods/${periodId}/candidates/${candidate.id}`}
                    >
                      {messages.viewCandidate}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h3 className={styles.panelHeading}>{messages.generateCandidateHeading}</h3>
        <p className={styles.panelIntro}>{messages.generateCandidateIntro}</p>
        <form className={styles.form} onSubmit={(event) => void handleGenerateCandidate(event)}>
          <div>
            <h4 className={styles.panelHeading}>{messages.weightsHeading}</h4>
            <p className={styles.hint}>{messages.weightsHint}</p>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label htmlFor="weight-primary-role">{messages.fieldWeightPrimaryRole}</label>
                <input
                  id="weight-primary-role"
                  type="number"
                  min={0}
                  max={100}
                  value={weightPrimaryRole}
                  onChange={(event) => setWeightPrimaryRole(event.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="weight-preferred-availability">
                  {messages.fieldWeightPreferredAvailability}
                </label>
                <input
                  id="weight-preferred-availability"
                  type="number"
                  min={0}
                  max={100}
                  value={weightPreferredAvailability}
                  onChange={(event) => setWeightPreferredAvailability(event.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="weight-load-balance">{messages.fieldWeightLoadBalance}</label>
                <input
                  id="weight-load-balance"
                  type="number"
                  min={0}
                  max={100}
                  value={weightLoadBalance}
                  onChange={(event) => setWeightLoadBalance(event.target.value)}
                />
              </div>
            </div>
          </div>

          {generateError ? (
            <div className={styles.errorBanner} role="alert">
              <p>{generateError}</p>
            </div>
          ) : null}

          <div className={styles.actionsRow}>
            <button type="submit" className={styles.primaryButton} disabled={generating}>
              {generating ? messages.generatingCandidate : messages.generateCandidateSubmit}
            </button>
          </div>
        </form>
      </section>

      {editServiceTarget ? (
        <div className={styles.dialogOverlay} role="presentation" onClick={closeEditServiceDialog}>
          <div
            className={styles.dialogWide}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-service-heading"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="edit-service-heading" className={styles.panelHeading}>
              {messages.editServiceHeading}
            </h2>
            <form className={styles.form} onSubmit={(event) => void handleEditServiceSubmit(event)}>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label htmlFor="edit-service-title">{messages.fieldTitle}</label>
                  <input
                    id="edit-service-title"
                    type="text"
                    maxLength={160}
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                  />
                  {editFieldErrors.title ? <p className={styles.fieldError}>{editFieldErrors.title}</p> : null}
                </div>
                <div className={styles.field}>
                  <label htmlFor="edit-service-date">{messages.fieldServiceDate}</label>
                  <input
                    id="edit-service-date"
                    type="date"
                    value={editServiceDate}
                    onChange={(event) => setEditServiceDate(event.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="edit-service-time">{messages.fieldServiceTime}</label>
                  <input
                    id="edit-service-time"
                    type="time"
                    value={editServiceTime}
                    onChange={(event) => setEditServiceTime(event.target.value)}
                  />
                  {editFieldErrors.startsAt ? (
                    <p className={styles.fieldError}>{editFieldErrors.startsAt}</p>
                  ) : null}
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="edit-service-notes">{messages.fieldNotes}</label>
                <textarea
                  id="edit-service-notes"
                  maxLength={2000}
                  rows={2}
                  value={editNotes}
                  onChange={(event) => setEditNotes(event.target.value)}
                />
              </div>

              <RoleRequirementsEditor
                idPrefix="edit-service"
                rows={editRequirementRows}
                roles={roles}
                onChange={setEditRequirementRows}
                error={editFieldErrors.requirements}
                heading={messages.requirementsHeading}
                hint={messages.requirementsHint}
                addLabel={messages.addRequirement}
                removeLabel={messages.removeRequirement}
                roleLabel={messages.fieldRole}
                countLabel={messages.fieldRequiredCount}
                selectPlaceholder={messages.selectRole}
              />

              {editFormError ? (
                <div className={styles.errorBanner} role="alert">
                  <p>{editFormError}</p>
                </div>
              ) : null}

              <div className={styles.actionsRow}>
                <button type="submit" className={styles.primaryButton} disabled={savingServiceEdit}>
                  {savingServiceEdit ? messages.savingServiceEdit : messages.editServiceSubmit}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={closeEditServiceDialog}
                  disabled={savingServiceEdit}
                >
                  {messages.closeEditServiceDialog}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteServiceTarget ? (
        <ConfirmDialog
          title={messages.deleteServiceConfirmTitle}
          body={messages.deleteServiceConfirmBody}
          confirmLabel={messages.deleteServiceConfirmConfirm}
          cancelLabel={messages.deleteServiceConfirmCancel}
          busy={deletingService}
          onConfirm={() => void handleDeleteService()}
          onCancel={() => setDeleteServiceTarget(null)}
        />
      ) : null}
    </div>
  );
}
