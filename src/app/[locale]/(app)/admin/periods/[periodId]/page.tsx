"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { isLocale, type Locale } from "@/i18n/config";
import { useAuth } from "@/lib/auth-client";
import {
  createService,
  generateCandidate,
  listCandidates,
  listPlanningPeriods,
  listRoles,
  listServices,
} from "../../api";
import { extractValidationFieldPaths, resolveApiErrorMessage } from "../../errors";
import { formatDate, formatDateTime, toSingaporeIsoString } from "../../format";
import { formatMessage, getAdminMessages } from "../../messages";
import { StatusBadge } from "../../status-badge";
import styles from "../../admin.module.css";
import type { CandidateSummary, PlanningPeriod, Role, Service } from "../../types";

type LoadState = "loading" | "ready" | "error";

type RequirementRow = Readonly<{ key: string; roleId: string; requiredCount: string }>;

let requirementRowKeySeed = 0;
function nextRequirementRowKey(): string {
  requirementRowKeySeed += 1;
  return `requirement-${requirementRowKeySeed}`;
}

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
  const [requirementRows, setRequirementRows] = useState<RequirementRow[]>([
    { key: nextRequirementRowKey(), roleId: "", requiredCount: "1" },
  ]);
  const [serviceFieldErrors, setServiceFieldErrors] = useState<Record<string, string>>({});
  const [serviceFormError, setServiceFormError] = useState<string | null>(null);
  const [serviceSuccess, setServiceSuccess] = useState(false);
  const [creatingService, setCreatingService] = useState(false);

  function updateRequirementRow(key: string, patch: Partial<RequirementRow>) {
    setRequirementRows((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRequirementRow() {
    setRequirementRows((rows) => [...rows, { key: nextRequirementRowKey(), roleId: "", requiredCount: "1" }]);
  }

  function removeRequirementRow(key: string) {
    setRequirementRows((rows) => (rows.length > 1 ? rows.filter((row) => row.key !== key) : rows));
  }

  function validateServiceForm(): Record<string, string> {
    const errors: Record<string, string> = {};
    const trimmedTitle = title.trim();
    if (!trimmedTitle || trimmedTitle.length > 160) {
      errors.title = messages.titleRequired;
    }
    if (!serviceDate || !serviceTime) {
      errors.startsAt = messages.serviceDateTimeRequired;
    }
    const seenRoles = new Set<string>();
    let duplicate = false;
    let outOfRange = false;
    for (const row of requirementRows) {
      if (!row.roleId) continue;
      if (seenRoles.has(row.roleId)) duplicate = true;
      seenRoles.add(row.roleId);
      const count = Number(row.requiredCount);
      if (!Number.isInteger(count) || count < 1 || count > 20) outOfRange = true;
    }
    const populatedRows = requirementRows.filter((row) => row.roleId);
    if (populatedRows.length === 0) {
      errors.requirements = messages.requirementsRequired;
    } else if (duplicate) {
      errors.requirements = messages.duplicateRole;
    } else if (outOfRange) {
      errors.requirements = messages.requiredCountRange;
    }
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
        requirements: requirementRows
          .filter((row) => row.roleId)
          .map((row) => ({ roleId: row.roleId, requiredCount: Number(row.requiredCount) })),
      });
      setServices((previous) =>
        [...previous, service].sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
      );
      setTitle("");
      setServiceDate("");
      setServiceTime("");
      setNotes("");
      setRequirementRows([{ key: nextRequirementRowKey(), roleId: "", requiredCount: "1" }]);
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
        {services.length === 0 ? (
          <p className={styles.emptyState}>{messages.servicesEmpty}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{messages.serviceColumnTitle}</th>
                <th>{messages.serviceColumnStart}</th>
                <th>{messages.serviceColumnNotes}</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id}>
                  <td>{service.title}</td>
                  <td>{formatDateTime(service.startsAt, locale)}</td>
                  <td>{service.notes ?? ""}</td>
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

          <div>
            <h4 className={styles.panelHeading}>{messages.requirementsHeading}</h4>
            <p className={styles.hint}>{messages.requirementsHint}</p>
            <div className={styles.requirementsList}>
              {requirementRows.map((row) => (
                <div className={styles.requirementRow} key={row.key}>
                  <div className={styles.field}>
                    <label htmlFor={`role-${row.key}`}>{messages.fieldRole}</label>
                    <select
                      id={`role-${row.key}`}
                      value={row.roleId}
                      onChange={(event) => updateRequirementRow(row.key, { roleId: event.target.value })}
                    >
                      <option value="">{messages.selectRole}</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`count-${row.key}`}>{messages.fieldRequiredCount}</label>
                    <input
                      id={`count-${row.key}`}
                      type="number"
                      min={1}
                      max={20}
                      value={row.requiredCount}
                      onChange={(event) =>
                        updateRequirementRow(row.key, { requiredCount: event.target.value })
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className={styles.smallButton}
                    onClick={() => removeRequirementRow(row.key)}
                    disabled={requirementRows.length === 1}
                  >
                    {messages.removeRequirement}
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className={styles.secondaryButton} onClick={addRequirementRow}>
              {messages.addRequirement}
            </button>
            {serviceFieldErrors.requirements ? (
              <p className={styles.fieldError}>{serviceFieldErrors.requirements}</p>
            ) : null}
          </div>

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
    </div>
  );
}
